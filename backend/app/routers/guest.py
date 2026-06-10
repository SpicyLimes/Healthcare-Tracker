# backend/app/routers/guest.py
import logging
import os
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.limiter import limiter
from app.models.audit_log import AuditAction, ActorType
from app.models.document import Document
from app.schemas.document import DocumentRead
from app.security.dependencies import GuestContext, get_guest_access, require_guest_section_access
from app.services.audit_service import log_event
from app.services.documents import INLINE_MIME_TYPES, get_documents_for_record

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/guest", tags=["guest"])

# Populated lazily to avoid circular imports at module load
_SECTION_MAP: dict[str, tuple[Any, Any]] = {}


def _get_section_map() -> dict[str, tuple[Any, Any]]:
    """Return mapping of section name → (SQLAlchemy model, Pydantic response schema)."""
    if _SECTION_MAP:
        return _SECTION_MAP
    from app.models.ailment import Ailment
    from app.models.doctor import Doctor
    from app.models.extended_records import (
        Appointment,
        DentalHistory,
        FamilyHistory,
        Hospitalization,
        Insurance,
        Pharmacy,
        Surgery,
        Vaccination,
        VisionHistory,
        VisitLog,
    )
    from app.models.medication import Medication
    from app.models.profile import Profile
    from app.schemas.extended_records import (
        AppointmentResponse,
        DentalHistoryResponse,
        FamilyHistoryResponse,
        HospitalizationResponse,
        InsuranceResponse,
        PharmacyResponse,
        SurgeryResponse,
        VaccinationResponse,
        VisionHistoryResponse,
        VisitLogResponse,
    )
    from app.schemas.records import (
        AilmentResponse,
        DoctorResponse,
        MedicationResponse,
        ProfileResponse,
    )

    _SECTION_MAP.update({
        "medications": (Medication, MedicationResponse),
        "doctors": (Doctor, DoctorResponse),
        "ailments": (Ailment, AilmentResponse),
        "profile": (Profile, ProfileResponse),
        "surgeries": (Surgery, SurgeryResponse),
        "hospitalizations": (Hospitalization, HospitalizationResponse),
        "vision_history": (VisionHistory, VisionHistoryResponse),
        "dental_history": (DentalHistory, DentalHistoryResponse),
        "visit_logs": (VisitLog, VisitLogResponse),
        "appointments": (Appointment, AppointmentResponse),
        "vaccinations": (Vaccination, VaccinationResponse),
        "insurances": (Insurance, InsuranceResponse),
        "pharmacies": (Pharmacy, PharmacyResponse),
        "family_history": (FamilyHistory, FamilyHistoryResponse),
    })
    return _SECTION_MAP


@router.get("/sections")
@limiter.limit("30/minute")
def get_allowed_sections(request: Request, response: Response, ctx: GuestContext = Depends(get_guest_access)):
    """Return the list of sections this token grants access to."""
    return ctx.allowed_sections if ctx.allowed_sections else list(_get_section_map().keys())


@router.get("/documents/{doc_id}/download")
@limiter.limit("30/minute")
def download_guest_document(
    request: Request,
    response: Response,
    doc_id: int,
    ctx: GuestContext = Depends(get_guest_access),
    db: Session = Depends(get_db),
):
    doc = db.get(Document, doc_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    require_guest_section_access(doc.section.value, ctx)
    file_path = os.path.join(settings.uploads_root, doc.section.value, doc.stored_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")
    disposition = "inline" if doc.mime_type in INLINE_MIME_TYPES else "attachment"
    log_event(
        db,
        action=AuditAction.share_link_access,
        actor_type=ActorType.guest,
        actor_share_link_id=ctx.share_link_id,
        section=doc.section.value,
        record_id=doc.record_id,
        detail=f"Guest downloaded document: {doc.filename}",
    )
    try:
        db.commit()
    except Exception:
        logger.exception("Guest handler commit failed")
        db.rollback()
    return FileResponse(
        path=file_path,
        media_type=doc.mime_type,
        filename=doc.filename,
        headers={"Content-Disposition": f'{disposition}; filename="{doc.filename}"'},
    )


@router.get("/{section}")
@limiter.limit("30/minute")
def list_guest_records(
    request: Request,
    response: Response,
    section: str,
    ctx: GuestContext = Depends(get_guest_access),
    db: Session = Depends(get_db),
):
    require_guest_section_access(section, ctx)
    section_map = _get_section_map()
    if section not in section_map:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown section")
    model, schema = section_map[section]
    rows = db.scalars(select(model)).all()
    log_event(
        db,
        action=AuditAction.share_link_access,
        actor_type=ActorType.guest,
        actor_share_link_id=ctx.share_link_id,
        section=section,
        detail=f"Guest listed {section}",
    )
    try:
        db.commit()
    except Exception:
        logger.exception("Guest handler commit failed")
        db.rollback()
    return [schema.model_validate(row) for row in rows]


@router.get("/{section}/{record_id}")
@limiter.limit("30/minute")
def get_guest_record(
    request: Request,
    response: Response,
    section: str,
    record_id: uuid.UUID,
    ctx: GuestContext = Depends(get_guest_access),
    db: Session = Depends(get_db),
):
    require_guest_section_access(section, ctx)
    section_map = _get_section_map()
    if section not in section_map:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown section")
    model, schema = section_map[section]
    row = db.get(model, record_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    log_event(
        db,
        action=AuditAction.share_link_access,
        actor_type=ActorType.guest,
        actor_share_link_id=ctx.share_link_id,
        section=section,
        record_id=str(record_id),
        detail=f"Guest viewed record in {section}",
    )
    try:
        db.commit()
    except Exception:
        logger.exception("Guest handler commit failed")
        db.rollback()
    return schema.model_validate(row)


@router.get("/{section}/{record_id}/documents", response_model=list[DocumentRead])
@limiter.limit("30/minute")
def list_guest_documents(
    request: Request,
    response: Response,
    section: str,
    record_id: uuid.UUID,
    ctx: GuestContext = Depends(get_guest_access),
    db: Session = Depends(get_db),
):
    require_guest_section_access(section, ctx)
    from app.models.document import DocumentSection
    try:
        sec_enum = DocumentSection(section)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown section")
    docs = get_documents_for_record(db, sec_enum, str(record_id))
    log_event(
        db,
        action=AuditAction.share_link_access,
        actor_type=ActorType.guest,
        actor_share_link_id=ctx.share_link_id,
        section=section,
        record_id=str(record_id),
        detail=f"Guest listed documents in {section}",
    )
    try:
        db.commit()
    except Exception:
        logger.exception("Guest handler commit failed")
        db.rollback()
    return docs
