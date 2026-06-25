import uuid
import pytest
from app.models.user import Role
from app.models.submission import SubmissionAction, SubmissionStatus
from app.services import user_service
from app.services.submission_service import (
    create_submission,
    approve_submission,
    reject_submission,
    list_submissions,
    AlreadyReviewedError,
    SubmissionNotFoundError,
    UnknownSectionError,
)


def _make_contributor(db):
    user_service.create_user(db, f"contrib+{uuid.uuid4().hex[:6]}@example.com", "Test1234!", Role.contributor)
    from sqlalchemy import select
    from app.models.user import User
    return db.scalars(select(User).where(User.role == Role.contributor)).first()


def _make_admin(db):
    user_service.create_user(db, f"admin+{uuid.uuid4().hex[:6]}@example.com", "Test1234!", Role.admin)
    from sqlalchemy import select
    from app.models.user import User
    return db.scalars(select(User).where(User.role == Role.admin)).first()


def test_create_submission_queues_record(db_session):
    contrib = _make_contributor(db_session)
    sub = create_submission(
        db_session,
        submitted_by_id=contrib.id,
        section="doctors",
        action=SubmissionAction.create,
        payload={"name": "Dr. Jane"},
    )
    assert sub.status == SubmissionStatus.pending
    assert sub.section == "doctors"


def test_create_submission_unknown_section_raises(db_session):
    contrib = _make_contributor(db_session)
    with pytest.raises(UnknownSectionError):
        create_submission(
            db_session,
            submitted_by_id=contrib.id,
            section="profile",
            action=SubmissionAction.create,
            payload={},
        )


def test_list_submissions_filters_by_status(db_session):
    contrib = _make_contributor(db_session)
    create_submission(db_session, contrib.id, "doctors", SubmissionAction.create, {"name": "Dr. A"})
    create_submission(db_session, contrib.id, "ailments", SubmissionAction.create, {"condition": "Hypertension"})
    pending = list_submissions(db_session, status=SubmissionStatus.pending)
    assert len(pending) == 2


def test_approve_submission_creates_record(db_session):
    contrib = _make_contributor(db_session)
    admin = _make_admin(db_session)
    sub = create_submission(
        db_session,
        submitted_by_id=contrib.id,
        section="doctors",
        action=SubmissionAction.create,
        payload={"name": "Dr. Approved"},
    )
    result = approve_submission(db_session, sub.id, admin.id)
    assert result.status == SubmissionStatus.approved
    assert result.reviewed_by == admin.id

    from app.models.doctor import Doctor
    from sqlalchemy import select
    doc = db_session.scalars(select(Doctor).where(Doctor.name == "Dr. Approved")).first()
    assert doc is not None


def test_reject_submission(db_session):
    contrib = _make_contributor(db_session)
    admin = _make_admin(db_session)
    sub = create_submission(
        db_session,
        submitted_by_id=contrib.id,
        section="ailments",
        action=SubmissionAction.create,
        payload={"condition": "Test"},
    )
    result = reject_submission(db_session, sub.id, admin.id, "Not enough detail")
    assert result.status == SubmissionStatus.rejected
    assert result.reject_reason == "Not enough detail"


def test_double_review_raises(db_session):
    contrib = _make_contributor(db_session)
    admin = _make_admin(db_session)
    sub = create_submission(
        db_session, contrib.id, "doctors", SubmissionAction.create, {"name": "Dr. Double"}
    )
    approve_submission(db_session, sub.id, admin.id)
    with pytest.raises(AlreadyReviewedError):
        approve_submission(db_session, sub.id, admin.id)


def test_approve_unknown_id_raises(db_session):
    admin = _make_admin(db_session)
    with pytest.raises(SubmissionNotFoundError):
        approve_submission(db_session, uuid.uuid4(), admin.id)
