import uuid
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.submission import Submission, SubmissionAction, SubmissionStatus
from app.models.user import User
from app.schemas.extended_records import (
    DentalHistoryCreate,
    FamilyHistoryCreate,
    HospitalizationCreate,
    InsuranceCreate,
    PharmacyCreate,
    SurgeryCreate,
    VaccinationCreate,
    VisionHistoryCreate,
    VitalsCreate,
)
from app.schemas.records import AilmentCreate, DoctorCreate, MedicationCreate
from app.services.crud_service import CRUDService

# Maps the section key (derived from the URL prefix) to the Create schema.
# On approve, the incoming payload is validated against this schema before
# being passed to CRUDService.create() to prevent storing invalid data.
SECTION_REGISTRY: dict[str, type[BaseModel]] = {
    "medications": MedicationCreate,
    "doctors": DoctorCreate,
    "ailments": AilmentCreate,
    "insurances": InsuranceCreate,
    "pharmacies": PharmacyCreate,
    "family_history": FamilyHistoryCreate,
    "surgeries": SurgeryCreate,
    "hospitalizations": HospitalizationCreate,
    "vision_history": VisionHistoryCreate,
    "dental_history": DentalHistoryCreate,
    "vaccinations": VaccinationCreate,
    "vitals": VitalsCreate,
}

# Maps the section key to the SQLAlchemy model (for update/delete approvals).
# Import lazily to avoid circular imports at module load time.
def _get_model(section: str):
    from app.models.ailment import Ailment
    from app.models.doctor import Doctor
    from app.models.medication import Medication
    from app.models.extended_records import (
        DentalHistory, FamilyHistory, Hospitalization,
        Insurance, Pharmacy, Surgery, Vaccination, VisionHistory, Vitals,
    )

    registry = {
        "medications": Medication,
        "doctors": Doctor,
        "ailments": Ailment,
        "insurances": Insurance,
        "pharmacies": Pharmacy,
        "family_history": FamilyHistory,
        "surgeries": Surgery,
        "hospitalizations": Hospitalization,
        "vision_history": VisionHistory,
        "dental_history": DentalHistory,
        "vaccinations": Vaccination,
        "vitals": Vitals,
    }
    if section not in registry:
        raise UnknownSectionError(section)
    return registry[section]


class SubmissionNotFoundError(Exception):
    pass


class AlreadyReviewedError(Exception):
    pass


class UnknownSectionError(Exception):
    pass


def create_submission(
    db: Session,
    submitted_by_id: uuid.UUID,
    section: str,
    action: SubmissionAction,
    payload: dict[str, Any],
    record_id: str | None = None,
) -> Submission:
    if section not in SECTION_REGISTRY:
        raise UnknownSectionError(section)
    sub = Submission(
        id=uuid.uuid4(),
        submitted_by=submitted_by_id,
        section=section,
        action=action,
        record_id=record_id,
        payload=payload,
        status=SubmissionStatus.pending,
    )
    db.add(sub)
    db.flush()
    return sub


def _get_or_404(db: Session, submission_id: uuid.UUID) -> Submission:
    sub = db.get(Submission, submission_id)
    if sub is None:
        raise SubmissionNotFoundError(str(submission_id))
    return sub


def approve_submission(
    db: Session,
    submission_id: uuid.UUID,
    reviewer_id: uuid.UUID,
) -> Submission:
    sub = _get_or_404(db, submission_id)
    if sub.status != SubmissionStatus.pending:
        raise AlreadyReviewedError(str(submission_id))

    model = _get_model(sub.section)
    service = CRUDService(model)

    if sub.action == SubmissionAction.create:
        schema_cls = SECTION_REGISTRY[sub.section]
        validated = schema_cls.model_validate(sub.payload)
        service.create(db, validated.model_dump(), created_by=reviewer_id)

    elif sub.action == SubmissionAction.update:
        record_id = uuid.UUID(sub.record_id)
        service.update(db, record_id, sub.payload)

    elif sub.action == SubmissionAction.delete:
        record_id = uuid.UUID(sub.record_id)
        service.delete(db, record_id)

    sub.status = SubmissionStatus.approved
    sub.reviewed_by = reviewer_id
    sub.reviewed_at = datetime.now(timezone.utc)
    db.flush()
    return sub


def reject_submission(
    db: Session,
    submission_id: uuid.UUID,
    reviewer_id: uuid.UUID,
    reason: str | None,
) -> Submission:
    sub = _get_or_404(db, submission_id)
    if sub.status != SubmissionStatus.pending:
        raise AlreadyReviewedError(str(submission_id))
    sub.status = SubmissionStatus.rejected
    sub.reviewed_by = reviewer_id
    sub.reviewed_at = datetime.now(timezone.utc)
    sub.reject_reason = reason
    db.flush()
    return sub


def list_submissions(
    db: Session,
    status: SubmissionStatus | None = None,
) -> list[Submission]:
    q = select(Submission)
    if status is not None:
        q = q.where(Submission.status == status)
    q = q.order_by(Submission.created_at.desc())
    return list(db.scalars(q).all())


def _user_label(db: Session, user_id: uuid.UUID | None) -> str:
    if user_id is None:
        return "deleted user"
    user = db.get(User, user_id)
    return user.email if user else f"deleted user ({user_id})"


def to_read(db: Session, sub: Submission) -> dict:
    """Convert a Submission ORM row to a SubmissionRead-compatible dict."""
    return {
        "id": sub.id,
        "submitted_by": sub.submitted_by,
        "submitted_by_label": _user_label(db, sub.submitted_by),
        "section": sub.section,
        "action": sub.action,
        "record_id": sub.record_id,
        "payload": sub.payload,
        "status": sub.status,
        "reviewed_by": sub.reviewed_by,
        "reviewed_by_label": _user_label(db, sub.reviewed_by) if sub.reviewed_by else None,
        "reviewed_at": sub.reviewed_at,
        "reject_reason": sub.reject_reason,
        "created_at": sub.created_at,
    }
