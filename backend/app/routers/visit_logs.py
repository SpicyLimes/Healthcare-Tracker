import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit_log import AuditAction, ActorType
from app.models.document import DocumentSection
from app.models.extended_records import VisitLog, Vitals
from app.models.user import User
from app.security.dependencies import get_current_user, require_admin, verify_csrf
from app.services.audit_service import log_event
from app.services.crud_service import CRUDService
from app.services.documents import delete_documents_for_record
from app.services.errors import NotFoundError
from app.schemas.extended_records import VisitLogCreate, VisitLogUpdate, VisitLogResponse
from app.routers.records import attach_document_routes

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/visit-logs", tags=["visit-logs"])
service = CRUDService(VisitLog)

_VITALS_FIELDS = ("bp_systolic", "bp_diastolic", "pulse_bpm")
_VISIT_LOG_COLUMNS = (
    "visit_date", "visit_time", "doctor_id", "doctor_other",
    "reason", "summary", "follow_up", "follow_up_date", "notes",
)


def _measured_at_from_visit(record: VisitLog):
    from datetime import datetime, time as time_cls, timezone
    if record.visit_date is None:
        return datetime.now(timezone.utc)
    t = record.visit_time or time_cls(0, 0)
    return datetime.combine(record.visit_date, t, tzinfo=timezone.utc)


def _sync_vitals(db: Session, record: VisitLog, vitals_data: dict, created_by: uuid.UUID):
    has_any = any(vitals_data.get(f) is not None for f in _VITALS_FIELDS)
    linked = db.get(Vitals, record.linked_vitals_id) if record.linked_vitals_id else None
    if linked is None and has_any:
        v = Vitals(
            measured_at=_measured_at_from_visit(record),
            visit_log_id=record.id,
            created_by=created_by,
            **{f: vitals_data.get(f) for f in _VITALS_FIELDS},
        )
        db.add(v)
        db.flush()
        record.linked_vitals_id = v.id
        db.flush()
    elif linked is not None:
        for f in _VITALS_FIELDS:
            setattr(linked, f, vitals_data.get(f))
        linked.measured_at = _measured_at_from_visit(record)
        db.flush()


def _attach_bp(record: VisitLog, db: Session) -> VisitLog:
    linked = db.get(Vitals, record.linked_vitals_id) if record.linked_vitals_id else None
    record.bp_systolic = linked.bp_systolic if linked else None
    record.bp_diastolic = linked.bp_diastolic if linked else None
    record.pulse_bpm = linked.pulse_bpm if linked else None
    return record


@router.get("", response_model=list[VisitLogResponse], dependencies=[Depends(get_current_user)])
def list_records(db: Session = Depends(get_db)):
    rows = list(db.scalars(select(VisitLog).order_by(VisitLog.created_at)))
    return [_attach_bp(r, db) for r in rows]


@router.get("/{record_id}", response_model=VisitLogResponse, dependencies=[Depends(get_current_user)])
def get_record(record_id: uuid.UUID, db: Session = Depends(get_db)):
    try:
        return _attach_bp(service.get(db, record_id), db)
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


@router.post(
    "",
    response_model=VisitLogResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
def create_record(
    payload: VisitLogCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    data = payload.model_dump()
    vitals_data = {f: data.pop(f) for f in _VITALS_FIELDS}
    record = service.create(db, {k: data[k] for k in _VISIT_LOG_COLUMNS if k in data}, created_by=current.id)
    _sync_vitals(db, record, vitals_data, current.id)
    try:
        log_event(
            db,
            action=AuditAction.create,
            actor_type=ActorType.user,
            actor_user_id=current.id,
            section="visit_logs",
            record_id=str(record.id),
            detail="Created record in visit-logs",
        )
    except Exception:
        logger.exception("Audit log failed for create in visit-logs — ignoring")
    return _attach_bp(record, db)


@router.put(
    "/{record_id}",
    response_model=VisitLogResponse,
    dependencies=[Depends(verify_csrf)],
)
def update_record(
    record_id: uuid.UUID,
    payload: VisitLogUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    data = payload.model_dump(exclude_unset=True)
    vitals_provided = any(f in data for f in _VITALS_FIELDS)
    vitals_data = {f: data.pop(f, None) for f in _VITALS_FIELDS}
    try:
        record = service.update(db, record_id, {k: v for k, v in data.items() if k in _VISIT_LOG_COLUMNS})
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if vitals_provided:
        _sync_vitals(db, record, vitals_data, current.id)
    try:
        log_event(
            db,
            action=AuditAction.update,
            actor_type=ActorType.user,
            actor_user_id=current.id,
            section="visit_logs",
            record_id=str(record_id),
            detail="Updated record in visit-logs",
        )
    except Exception:
        logger.exception("Audit log failed for update in visit-logs — ignoring")
    return _attach_bp(record, db)


@router.delete(
    "/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf)],
)
def delete_record(
    record_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    delete_documents_for_record(db, DocumentSection.visit_logs, str(record_id))
    try:
        service.delete(db, record_id)
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    try:
        log_event(
            db,
            action=AuditAction.delete,
            actor_type=ActorType.user,
            actor_user_id=current.id,
            section="visit_logs",
            record_id=str(record_id),
            detail="Deleted record in visit-logs",
        )
    except Exception:
        logger.exception("Audit log failed for delete in visit-logs — ignoring")


attach_document_routes(router, DocumentSection.visit_logs, VisitLog)
