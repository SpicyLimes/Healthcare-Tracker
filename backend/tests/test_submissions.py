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
    user_service.create_user(db, f"contrib+{uuid.uuid4().hex[:6]}@example.com", "TestPassword1234!", Role.contributor)
    from sqlalchemy import select
    from app.models.user import User
    return db.scalars(select(User).where(User.role == Role.contributor)).first()


def _make_admin(db):
    user_service.create_user(db, f"admin+{uuid.uuid4().hex[:6]}@example.com", "TestPassword1234!", Role.admin)
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


# ---- Endpoint tests ----

def _contrib_login(client, db_session):
    email = f"contrib+{uuid.uuid4().hex[:6]}@test.com"
    user_service.create_user(db_session, email, "TestPassword1234!", Role.contributor)
    client.post("/api/auth/login", json={"email": email, "password": "TestPassword1234!"})
    return client.cookies.get("csrf_token")


def _admin_login_ep(client, db_session):
    email = f"admin+{uuid.uuid4().hex[:6]}@test.com"
    user_service.create_user(db_session, email, "TestPassword1234!", Role.admin)
    client.post("/api/auth/login", json={"email": email, "password": "TestPassword1234!"})
    return client.cookies.get("csrf_token")


def test_contributor_create_queues_submission(client, db_session):
    csrf = _contrib_login(client, db_session)
    res = client.post(
        "/api/doctors",
        headers={"X-CSRF-Token": csrf},
        json={"name": "Dr. Queue"},
    )
    assert res.status_code == 201
    # The record should NOT be in the doctors table yet
    doctors = client.get("/api/doctors").json()
    assert not any(d["name"] == "Dr. Queue" for d in doctors)


def test_contributor_cannot_view_submissions_list(client, db_session):
    _contrib_login(client, db_session)
    res = client.get("/api/submissions")
    assert res.status_code == 403


def test_admin_can_list_submissions(client, db_session):
    csrf_c = _contrib_login(client, db_session)
    client.post("/api/doctors", headers={"X-CSRF-Token": csrf_c}, json={"name": "Dr. List"})
    # Now login as admin
    csrf_a = _admin_login_ep(client, db_session)
    res = client.get("/api/submissions")
    assert res.status_code == 200
    assert any(s["payload"].get("name") == "Dr. List" for s in res.json())


def test_admin_approve_creates_record(client, db_session):
    csrf_c = _contrib_login(client, db_session)
    client.post("/api/doctors", headers={"X-CSRF-Token": csrf_c}, json={"name": "Dr. Approve"})
    csrf_a = _admin_login_ep(client, db_session)
    subs = client.get("/api/submissions").json()
    sub_id = next(s["id"] for s in subs if s["payload"].get("name") == "Dr. Approve")
    res = client.post(f"/api/submissions/{sub_id}/approve", headers={"X-CSRF-Token": csrf_a})
    assert res.status_code == 200
    assert res.json()["status"] == "approved"
    doctors = client.get("/api/doctors").json()
    assert any(d["name"] == "Dr. Approve" for d in doctors)


def test_admin_reject_submission(client, db_session):
    csrf_c = _contrib_login(client, db_session)
    client.post("/api/ailments", headers={"X-CSRF-Token": csrf_c}, json={"condition": "Rej Test"})
    csrf_a = _admin_login_ep(client, db_session)
    subs = client.get("/api/submissions").json()
    sub_id = next(s["id"] for s in subs if s["payload"].get("condition") == "Rej Test")
    res = client.post(
        f"/api/submissions/{sub_id}/reject",
        headers={"X-CSRF-Token": csrf_a},
        json={"reject_reason": "Needs more detail"},
    )
    assert res.status_code == 200
    assert res.json()["status"] == "rejected"
    assert res.json()["reject_reason"] == "Needs more detail"


def test_viewer_cannot_create_record(client, db_session):
    email = f"viewer+{uuid.uuid4().hex[:6]}@test.com"
    user_service.create_user(db_session, email, "TestPassword1234!", Role.viewer)
    client.post("/api/auth/login", json={"email": email, "password": "TestPassword1234!"})
    csrf = client.cookies.get("csrf_token")
    res = client.post("/api/doctors", headers={"X-CSRF-Token": csrf}, json={"name": "Should Fail"})
    assert res.status_code == 403


def test_pending_count(client, db_session):
    csrf_c = _contrib_login(client, db_session)
    client.post("/api/doctors", headers={"X-CSRF-Token": csrf_c}, json={"name": "Count Test"})
    csrf_a = _admin_login_ep(client, db_session)
    res = client.get("/api/submissions/pending-count")
    assert res.status_code == 200
    assert res.json()["count"] >= 1


def test_contributor_can_create_and_edit_own_note(client, db_session):
    csrf_c = _contrib_login(client, db_session)
    res = client.post(
        "/api/notes",
        headers={"X-CSRF-Token": csrf_c},
        json={"title": "Contrib Note", "body": "body", "pinned": False, "done": False},
    )
    assert res.status_code == 201
    note_id = res.json()["id"]
    # Edit own note
    res2 = client.patch(
        f"/api/notes/{note_id}",
        headers={"X-CSRF-Token": csrf_c},
        json={"title": "Edited"},
    )
    assert res2.status_code == 200


def test_contributor_cannot_delete_note(client, db_session):
    csrf_a = _admin_login_ep(client, db_session)
    # Create via admin
    res = client.post(
        "/api/notes",
        headers={"X-CSRF-Token": csrf_a},
        json={"title": "Admin Note", "body": "", "pinned": False, "done": False},
    )
    note_id = res.json()["id"]
    csrf_c = _contrib_login(client, db_session)
    res2 = client.delete(f"/api/notes/{note_id}", headers={"X-CSRF-Token": csrf_c})
    assert res2.status_code == 403
