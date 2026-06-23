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

_VITALS_FIELDS = (
    "bp_systolic", "bp_diastolic", "pulse_bpm",
    "height_in", "weight_lb", "temperature_f",
    "respiratory_rate", "spo2", "blood_glucose",
)
_VISIT_LOG_COLUMNS = (
    "visit_date", "visit_time", "doctor_id", "doctor_other",
    "reason", "summary", "follow_up", "follow_up_date", "notes",
)


def _measured_at_from_visit(record: VisitLog, tz: str):
    """Build a UTC datetime for the linked Vitals entry from the visit's date(+time),
    interpreting that wall-clock value in the user's timezone `tz`.

    The visit stores a naive date/time the user entered in their own zone; stamping it
    as UTC directly would shift it (e.g. midnight Central -> previous-day 19:00 on display).
    """
    from datetime import datetime, time as time_cls, timezone
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
    if record.visit_date is None:
        return datetime.now(timezone.utc)
    try:
        zone = ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError):
        zone = ZoneInfo("America/Chicago")
    t = record.visit_time or time_cls(0, 0)
    local_dt = datetime.combine(record.visit_date, t, tzinfo=zone)
    return local_dt.astimezone(timezone.utc)


def _sync_vitals(db: Session, record: VisitLog, vitals_data: dict, created_by: uuid.UUID, tz: str):
    has_any = any(vitals_data.get(f) is not None for f in _VITALS_FIELDS)
    linked = db.get(Vitals, record.linked_vitals_id) if record.linked_vitals_id else None
    if linked is None and has_any:
        v = Vitals(
            measured_at=_measured_at_from_visit(record, tz),
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
        linked.measured_at = _measured_at_from_visit(record, tz)
        # Keep both sides of the circular FK in sync: Vitals.visit_log_id must
        # point back to this VisitLog, otherwise the two pointers have drifted.
        if linked.visit_log_id != record.id:
            linked.visit_log_id = record.id
        db.flush()


def _resync_measured_at(db: Session, record: VisitLog, tz: str):
    """Re-stamp a linked Vitals entry's measured_at when the visit's date/time changed,
    without touching its BP/Pulse or other fields. No-op if there's no linked entry."""
    linked = db.get(Vitals, record.linked_vitals_id) if record.linked_vitals_id else None
    if linked is not None:
        linked.measured_at = _measured_at_from_visit(record, tz)
        db.flush()


def _attach_vitals(record: VisitLog, db: Session) -> VisitLog:
    linked = db.get(Vitals, record.linked_vitals_id) if record.linked_vitals_id else None
    for f in _VITALS_FIELDS:
        setattr(record, f, getattr(linked, f) if linked else None)
    return record


def _attach_vitals_batch(rows: list[VisitLog], db: Session) -> list[VisitLog]:
    """Single-query variant: fetches all linked Vitals rows in one IN query."""
    ids = [r.linked_vitals_id for r in rows if r.linked_vitals_id is not None]
    if ids:
        vitals_map = {v.id: v for v in db.scalars(select(Vitals).where(Vitals.id.in_(ids)))}
    else:
        vitals_map = {}
    for r in rows:
        linked = vitals_map.get(r.linked_vitals_id) if r.linked_vitals_id else None
        for f in _VITALS_FIELDS:
            setattr(r, f, getattr(linked, f) if linked else None)
    return rows


@router.get("", response_model=list[VisitLogResponse], dependencies=[Depends(get_current_user)])
def list_records(db: Session = Depends(get_db)):
    rows = list(db.scalars(select(VisitLog).order_by(VisitLog.created_at)))
    return _attach_vitals_batch(rows, db)


@router.get("/{record_id}", response_model=VisitLogResponse, dependencies=[Depends(get_current_user)])
def get_record(record_id: uuid.UUID, db: Session = Depends(get_db)):
    try:
        return _attach_vitals(service.get(db, record_id), db)
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
    vitals_data = {f: data.pop(f, None) for f in _VITALS_FIELDS}
    record = service.create(db, {k: data[k] for k in _VISIT_LOG_COLUMNS if k in data}, created_by=current.id)
    _sync_vitals(db, record, vitals_data, current.id, current.timezone)
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
    return _attach_vitals(record, db)


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
    datetime_changed = "visit_date" in data or "visit_time" in data
    vitals_data = {f: data.pop(f, None) for f in _VITALS_FIELDS}
    try:
        record = service.update(db, record_id, {k: v for k, v in data.items() if k in _VISIT_LOG_COLUMNS})
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if vitals_provided:
        _sync_vitals(db, record, vitals_data, current.id, current.timezone)
    elif datetime_changed:
        # Visit date/time changed but BP/Pulse weren't touched — keep the linked
        # Vitals entry's timestamp in step with the visit (no-op if unlinked).
        _resync_measured_at(db, record, current.timezone)
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
    return _attach_vitals(record, db)


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
