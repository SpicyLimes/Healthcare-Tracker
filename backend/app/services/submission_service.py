import uuid
from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel
from sqlalchemy import inspect as sa_inspect, select
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
from app.schemas.extended_records import (
    DentalHistoryUpdate,
    FamilyHistoryUpdate,
    HospitalizationUpdate,
    InsuranceUpdate,
    PharmacyUpdate,
    SurgeryUpdate,
    VaccinationUpdate,
    VisionHistoryUpdate,
    VitalsUpdate,
)
from app.schemas.records import (
    AilmentCreate,
    AilmentUpdate,
    DoctorCreate,
    DoctorUpdate,
    MedicationCreate,
    MedicationUpdate,
)
from app.services.crud_service import CRUDService
from app.services.errors import NotFoundError

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

# Maps the section key to the Update schema, used to re-validate an amended
# payload for a pending UPDATE submission (partial — exclude_unset on dump).
SECTION_UPDATE_REGISTRY: dict[str, type[BaseModel]] = {
    "medications": MedicationUpdate,
    "doctors": DoctorUpdate,
    "ailments": AilmentUpdate,
    "insurances": InsuranceUpdate,
    "pharmacies": PharmacyUpdate,
    "family_history": FamilyHistoryUpdate,
    "surgeries": SurgeryUpdate,
    "hospitalizations": HospitalizationUpdate,
    "vision_history": VisionHistoryUpdate,
    "dental_history": DentalHistoryUpdate,
    "vaccinations": VaccinationUpdate,
    "vitals": VitalsUpdate,
}

# Maps section keys that have associated documents to their DocumentSection enum
# value string.  Used by approve_submission to cascade-delete documents before
# deleting the record (mirrors what build_list_router's admin delete path does).
DOCUMENT_SECTION_REGISTRY: dict[str, str] = {
    "medications": "medications",
    "doctors": "doctors",
    "ailments": "ailments",
    "surgeries": "surgeries",
    "hospitalizations": "hospitalizations",
    "dental_history": "dental_history",
    "insurances": "insurances",
    "vision_history": "vision_history",
    "vaccinations": "vaccinations",
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


class TargetRecordMissingError(Exception):
    """Raised when approving an update/delete submission whose target record
    no longer exists. The submission is auto-rejected before this is raised."""
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


_MISSING_TARGET_REASON = (
    "Target record no longer exists; submission auto-rejected on approval."
)


def _auto_reject_missing_target(
    db: Session, sub: Submission, reviewer_id: uuid.UUID
) -> None:
    """Mark a submission rejected because its target record is gone, so it
    leaves the pending queue instead of being stuck as an un-approvable item."""
    sub.status = SubmissionStatus.rejected
    sub.reviewed_by = reviewer_id
    sub.reviewed_at = datetime.now(timezone.utc)
    sub.reject_reason = _MISSING_TARGET_REASON
    db.flush()


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
        if sub.record_id is None:
            raise SubmissionNotFoundError("update submission missing record_id")
        record_id = uuid.UUID(sub.record_id)
        try:
            service.update(db, record_id, sub.payload)
        except NotFoundError:
            _auto_reject_missing_target(db, sub, reviewer_id)
            raise TargetRecordMissingError(str(submission_id))

    elif sub.action == SubmissionAction.delete:
        if sub.record_id is None:
            raise SubmissionNotFoundError("delete submission missing record_id")
        record_id = uuid.UUID(sub.record_id)
        # Confirm the record still exists BEFORE cascading documents, so a stale
        # submission doesn't trigger delete_documents_for_record's internal
        # commit on a doomed approval.
        try:
            service.get(db, record_id)
        except NotFoundError:
            _auto_reject_missing_target(db, sub, reviewer_id)
            raise TargetRecordMissingError(str(submission_id))
        if sub.section in DOCUMENT_SECTION_REGISTRY:
            from app.services.documents import delete_documents_for_record
            from app.models.document import DocumentSection as _DocumentSection
            doc_section = _DocumentSection(DOCUMENT_SECTION_REGISTRY[sub.section])
            delete_documents_for_record(db, doc_section, str(record_id))
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


def list_own_submissions(db: Session, user_id: uuid.UUID) -> list[Submission]:
    q = (
        select(Submission)
        .where(Submission.submitted_by == user_id)
        .order_by(Submission.created_at.desc())
    )
    return list(db.scalars(q).all())


def count_own_pending(db: Session, user_id: uuid.UUID) -> int:
    from sqlalchemy import func
    return db.scalar(
        select(func.count())
        .select_from(Submission)
        .where(
            Submission.submitted_by == user_id,
            Submission.status == SubmissionStatus.pending,
        )
    ) or 0


def _get_own_pending_or_raise(
    db: Session, submission_id: uuid.UUID, user_id: uuid.UUID
) -> Submission:
    sub = db.get(Submission, submission_id)
    # Not-yours and not-found both surface as 404 (do not reveal existence).
    if sub is None or sub.submitted_by != user_id:
        raise SubmissionNotFoundError(str(submission_id))
    if sub.status != SubmissionStatus.pending:
        raise AlreadyReviewedError(str(submission_id))
    return sub


def amend_own_submission(
    db: Session, submission_id: uuid.UUID, user_id: uuid.UUID, payload: dict
) -> Submission:
    sub = _get_own_pending_or_raise(db, submission_id, user_id)
    # Re-validate the amended payload against the section schema by action.
    if sub.action == SubmissionAction.create:
        schema_cls = SECTION_REGISTRY[sub.section]
        validated = schema_cls.model_validate(payload)
        sub.payload = validated.model_dump(mode="json")
    elif sub.action == SubmissionAction.update:
        schema_cls = SECTION_UPDATE_REGISTRY[sub.section]
        validated = schema_cls.model_validate(payload)
        sub.payload = validated.model_dump(mode="json", exclude_unset=True)
    else:  # delete submissions carry no editable payload
        raise AlreadyReviewedError(str(submission_id))
    db.flush()
    return sub


def withdraw_own_submission(
    db: Session, submission_id: uuid.UUID, user_id: uuid.UUID
) -> Submission:
    sub = _get_own_pending_or_raise(db, submission_id, user_id)
    db.delete(sub)
    db.flush()
    return sub


def _user_label(db: Session, user_id: uuid.UUID | None) -> str:
    if user_id is None:
        return "deleted user"
    user = db.get(User, user_id)
    return user.email if user else f"deleted user ({user_id})"


def _current_values(db: Session, sub: Submission) -> dict | None:
    """The target record's values as they stand right now.

    Approving used to be blind: the queue rendered only the proposed payload, so
    "frequency: Three times daily" gave no hint that it is currently "Twice
    daily" — a clinical decision made without the comparison. A pending delete
    was worse: its payload is {} and it rendered as "(no fields)", so approving
    permanently removed a record whose name was never shown.

    Resolved server-side because the section→model registry already lives here;
    doing it in the browser would mean a fetch against 12 different API modules.
    Returns None for creates (nothing exists yet) and for records deleted out
    from under a still-pending submission.
    """
    if sub.action == SubmissionAction.create or not sub.record_id:
        return None
    try:
        model = _get_model(sub.section)
    except UnknownSectionError:
        return None
    try:
        record_uuid = uuid.UUID(sub.record_id)
    except (ValueError, AttributeError):
        return None
    record = db.get(model, record_uuid)
    if record is None:
        return None
    return {
        c.key: getattr(record, c.key)
        for c in sa_inspect(model).mapper.column_attrs
    }


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
        "current_values": _current_values(db, sub),
        "status": sub.status,
        "reviewed_by": sub.reviewed_by,
        "reviewed_by_label": _user_label(db, sub.reviewed_by) if sub.reviewed_by else None,
        "reviewed_at": sub.reviewed_at,
        "reject_reason": sub.reject_reason,
        "created_at": sub.created_at,
    }
