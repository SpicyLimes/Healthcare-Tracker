import logging
import uuid
from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit_log import AuditAction, ActorType
from app.models.document import DocumentSection
from app.models.extended_records import Appointment, VisitLog
from app.models.user import User
from app.security.dependencies import get_current_user, require_admin, verify_csrf
from app.services.audit_service import log_event
from app.services.crud_service import CRUDService
from app.services.documents import delete_documents_for_record
from app.services.errors import NotFoundError
from app.schemas.extended_records import AppointmentCreate, AppointmentUpdate, AppointmentResponse
from app.routers.records import attach_document_routes

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/appointments", tags=["appointments"])
_appt_service = CRUDService(Appointment)
_vl_service = CRUDService(VisitLog)


def _auto_create_visit_log(db: Session, appt: Appointment, created_by: uuid.UUID) -> None:
    """Create a Visit Log from a just-completed appointment (idempotent: skips if already linked)."""
    if appt.visit_log_id is not None:
        return
    local_dt = appt.appointment_datetime.astimezone(timezone.utc)
    vl = _vl_service.create(db, {
        "visit_date": local_dt.date(),
        "visit_time": local_dt.time().replace(tzinfo=None),
        "doctor_id": appt.doctor_id,
        "doctor_other": appt.doctor_other,
        "reason": appt.reason,
    }, created_by=created_by)
    appt.visit_log_id = vl.id
    db.flush()


@router.get("", response_model=list[AppointmentResponse], dependencies=[Depends(get_current_user)])
def list_records(db: Session = Depends(get_db)):
    return _appt_service.list(db)


@router.get("/{record_id}", response_model=AppointmentResponse, dependencies=[Depends(get_current_user)])
def get_record(record_id: uuid.UUID, db: Session = Depends(get_db)):
    try:
        return _appt_service.get(db, record_id)
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")


@router.post(
    "",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
def create_record(
    payload: AppointmentCreate,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    record = _appt_service.create(db, payload.model_dump(), created_by=current.id)
    try:
        log_event(db, action=AuditAction.create, actor_type=ActorType.user,
                  actor_user_id=current.id, section="appointments",
                  record_id=str(record.id), detail="Created record in appointments")
    except Exception:
        logger.exception("Audit log failed for create in appointments — ignoring")
    return record


@router.put("/{record_id}", response_model=AppointmentResponse, dependencies=[Depends(verify_csrf)])
def update_record(
    record_id: uuid.UUID,
    payload: AppointmentUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    try:
        appt = _appt_service.get(db, record_id)
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    prev_status = appt.status
    data = payload.model_dump(exclude_unset=True)
    try:
        record = _appt_service.update(db, record_id, data)
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    # Side effect: auto-create Visit Log when transitioning to completed for the first time
    if data.get("status") == "completed" and prev_status != "completed":
        _auto_create_visit_log(db, record, current.id)

    try:
        log_event(db, action=AuditAction.update, actor_type=ActorType.user,
                  actor_user_id=current.id, section="appointments",
                  record_id=str(record_id), detail="Updated record in appointments")
    except Exception:
        logger.exception("Audit log failed for update in appointments — ignoring")
    return record


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
    delete_documents_for_record(db, DocumentSection.appointments, str(record_id))
    try:
        _appt_service.delete(db, record_id)
    except NotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    try:
        log_event(db, action=AuditAction.delete, actor_type=ActorType.user,
                  actor_user_id=current.id, section="appointments",
                  record_id=str(record_id), detail="Deleted record in appointments")
    except Exception:
        logger.exception("Audit log failed for delete in appointments — ignoring")


attach_document_routes(router, DocumentSection.appointments, Appointment)
