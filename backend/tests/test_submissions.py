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
    TargetRecordMissingError,
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


def test_approve_delete_with_missing_record_auto_rejects(db_session):
    # A contributor proposes deleting a record, then the record is gone by the
    # time the admin approves. The submission must auto-reject (not 500/stick).
    contrib = _make_contributor(db_session)
    admin = _make_admin(db_session)
    sub = create_submission(
        db_session,
        submitted_by_id=contrib.id,
        section="doctors",
        action=SubmissionAction.delete,
        payload={},
        record_id=str(uuid.uuid4()),  # a record id that does not exist
    )
    with pytest.raises(TargetRecordMissingError):
        approve_submission(db_session, sub.id, admin.id)
    # The submission left the pending queue with a clear reason.
    from app.models.submission import Submission
    refreshed = db_session.get(Submission, sub.id)
    assert refreshed.status == SubmissionStatus.rejected
    assert refreshed.reviewed_by == admin.id
    assert "no longer exists" in refreshed.reject_reason


def test_approve_update_with_missing_record_auto_rejects(db_session):
    contrib = _make_contributor(db_session)
    admin = _make_admin(db_session)
    sub = create_submission(
        db_session,
        submitted_by_id=contrib.id,
        section="doctors",
        action=SubmissionAction.update,
        payload={"name": "Renamed"},
        record_id=str(uuid.uuid4()),
    )
    with pytest.raises(TargetRecordMissingError):
        approve_submission(db_session, sub.id, admin.id)
    from app.models.submission import Submission
    refreshed = db_session.get(Submission, sub.id)
    assert refreshed.status == SubmissionStatus.rejected


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


# ---- C1 regression: contributor create must return 201 for EVERY section ----
# The synthetic response object is built from the create payload + system fields
# and validated against the response schema. A response-schema field that is
# required but absent from the create payload (e.g. VitalsResponse.visit_log_id)
# previously raised a 500. This exercises all 12 registered sections, not just
# doctors, so that class of bug can't recur silently.

# (section URL prefix, minimal valid create payload)
_SECTION_CREATE_CASES = [
    ("/api/medications", {"name": "Test Med"}),
    ("/api/doctors", {"name": "Dr. Test"}),
    ("/api/ailments", {"condition": "Test Condition"}),
    ("/api/insurances", {"insurer_name": "Test Insurer"}),
    ("/api/pharmacies", {"name": "Test Pharmacy"}),
    ("/api/family-history", {"relative": "Mother", "condition": "Test"}),
    ("/api/surgeries", {"procedure": "Test Procedure"}),
    ("/api/hospitalizations", {"facility": "Test Facility"}),
    ("/api/vision-history", {"visit_date": "2026-01-01"}),
    ("/api/dental-history", {"visit_date": "2026-01-01"}),
    ("/api/vaccinations", {"vaccine": "Test Vaccine"}),
    ("/api/vitals", {"measured_at": "2026-01-01T10:00:00Z", "bp_systolic": 120, "bp_diastolic": 80}),
]


@pytest.mark.parametrize("prefix,payload", _SECTION_CREATE_CASES)
def test_contributor_create_returns_201_for_all_sections(client, db_session, prefix, payload):
    csrf = _contrib_login(client, db_session)
    res = client.post(prefix, headers={"X-CSRF-Token": csrf}, json=payload)
    assert res.status_code == 201, f"{prefix} -> {res.status_code}: {res.text}"
    # And it must be queued, not written directly.
    body = res.json()
    assert "id" in body


# ---- Own-submission service tests (Task 3) ----

def _distinct_contributor(db):
    """Create a fresh contributor and return it (distinct from any other)."""
    from sqlalchemy import select
    from app.models.user import User
    email = f"own+{uuid.uuid4().hex[:8]}@example.com"
    user_service.create_user(db, email, "TestPassword1234!", Role.contributor)
    return db.scalars(select(User).where(User.email == email)).first()


def test_list_own_submissions_scoped_to_user(db_session):
    from app.services.submission_service import list_own_submissions
    c1 = _distinct_contributor(db_session)
    c2 = _distinct_contributor(db_session)
    create_submission(db_session, c1.id, "doctors", SubmissionAction.create, {"name": "Mine"})
    create_submission(db_session, c2.id, "doctors", SubmissionAction.create, {"name": "Theirs"})
    mine = list_own_submissions(db_session, c1.id)
    assert len(mine) == 1
    assert mine[0].payload["name"] == "Mine"


def test_count_own_pending(db_session):
    from app.services.submission_service import count_own_pending
    c = _distinct_contributor(db_session)
    a = _make_admin(db_session)
    s1 = create_submission(db_session, c.id, "doctors", SubmissionAction.create, {"name": "A"})
    create_submission(db_session, c.id, "doctors", SubmissionAction.create, {"name": "B"})
    assert count_own_pending(db_session, c.id) == 2
    approve_submission(db_session, s1.id, a.id)
    assert count_own_pending(db_session, c.id) == 1


def test_amend_own_submission_updates_payload(db_session):
    from app.services.submission_service import amend_own_submission
    c = _distinct_contributor(db_session)
    s = create_submission(db_session, c.id, "doctors", SubmissionAction.create, {"name": "Old"})
    amend_own_submission(db_session, s.id, c.id, {"name": "New"})
    assert s.payload["name"] == "New"


def test_amend_rejects_invalid_payload(db_session):
    from pydantic import ValidationError
    from app.services.submission_service import amend_own_submission
    c = _distinct_contributor(db_session)
    s = create_submission(db_session, c.id, "doctors", SubmissionAction.create, {"name": "Old"})
    with pytest.raises(ValidationError):
        amend_own_submission(db_session, s.id, c.id, {})  # name required for create


def test_amend_not_owner_raises_notfound(db_session):
    from app.services.submission_service import amend_own_submission
    c1 = _distinct_contributor(db_session)
    c2 = _distinct_contributor(db_session)
    s = create_submission(db_session, c1.id, "doctors", SubmissionAction.create, {"name": "X"})
    with pytest.raises(SubmissionNotFoundError):
        amend_own_submission(db_session, s.id, c2.id, {"name": "Y"})


def test_amend_non_pending_raises_already_reviewed(db_session):
    from app.services.submission_service import amend_own_submission
    c = _distinct_contributor(db_session)
    a = _make_admin(db_session)
    s = create_submission(db_session, c.id, "doctors", SubmissionAction.create, {"name": "X"})
    approve_submission(db_session, s.id, a.id)
    with pytest.raises(AlreadyReviewedError):
        amend_own_submission(db_session, s.id, c.id, {"name": "Y"})


def test_withdraw_own_submission_deletes(db_session):
    from app.models.submission import Submission
    from app.services.submission_service import withdraw_own_submission
    c = _distinct_contributor(db_session)
    s = create_submission(db_session, c.id, "doctors", SubmissionAction.create, {"name": "Bye"})
    sid = s.id
    withdraw_own_submission(db_session, sid, c.id)
    assert db_session.get(Submission, sid) is None


def test_withdraw_not_owner_raises_notfound(db_session):
    from app.services.submission_service import withdraw_own_submission
    c1 = _distinct_contributor(db_session)
    c2 = _distinct_contributor(db_session)
    s = create_submission(db_session, c1.id, "doctors", SubmissionAction.create, {"name": "X"})
    with pytest.raises(SubmissionNotFoundError):
        withdraw_own_submission(db_session, s.id, c2.id)


# ---- Contributor endpoint tests (Task 4) ----

def test_get_mine_returns_only_own(client, db_session):
    csrf = _contrib_login(client, db_session)
    client.post("/api/doctors", headers={"X-CSRF-Token": csrf}, json={"name": "Mine D"})
    res = client.get("/api/submissions/mine")
    assert res.status_code == 200
    assert all(s["section"] == "doctors" for s in res.json())
    assert any(s["payload"]["name"] == "Mine D" for s in res.json())


def test_get_mine_pending_count(client, db_session):
    csrf = _contrib_login(client, db_session)
    client.post("/api/doctors", headers={"X-CSRF-Token": csrf}, json={"name": "C1"})
    res = client.get("/api/submissions/mine/pending-count")
    assert res.status_code == 200
    assert res.json()["count"] >= 1


def test_viewer_cannot_get_mine(client, db_session):
    from app.models.user import Role
    import uuid as _uuid
    email = f"v+{_uuid.uuid4().hex[:6]}@test.com"
    user_service.create_user(db_session, email, "TestPassword1234!", Role.viewer)
    client.post("/api/auth/login", json={"email": email, "password": "TestPassword1234!"})
    assert client.get("/api/submissions/mine").status_code == 403


def test_amend_own_pending_via_endpoint(client, db_session):
    csrf = _contrib_login(client, db_session)
    client.post("/api/doctors", headers={"X-CSRF-Token": csrf}, json={"name": "Before"})
    sid = client.get("/api/submissions/mine").json()[0]["id"]
    res = client.patch(
        f"/api/submissions/{sid}",
        headers={"X-CSRF-Token": csrf},
        json={"payload": {"name": "After"}},
    )
    assert res.status_code == 200
    assert res.json()["payload"]["name"] == "After"


def test_withdraw_own_pending_via_endpoint(client, db_session):
    csrf = _contrib_login(client, db_session)
    client.post("/api/doctors", headers={"X-CSRF-Token": csrf}, json={"name": "Gone"})
    sid = client.get("/api/submissions/mine").json()[0]["id"]
    res = client.delete(f"/api/submissions/{sid}", headers={"X-CSRF-Token": csrf})
    assert res.status_code == 204
    assert all(s["id"] != sid for s in client.get("/api/submissions/mine").json())


def test_amend_others_submission_404(client, db_session):
    csrf1 = _contrib_login(client, db_session)
    client.post("/api/doctors", headers={"X-CSRF-Token": csrf1}, json={"name": "C1 D"})
    sid = client.get("/api/submissions/mine").json()[0]["id"]
    csrf2 = _contrib_login(client, db_session)  # logs in as a different contributor
    res = client.patch(f"/api/submissions/{sid}", headers={"X-CSRF-Token": csrf2}, json={"payload": {"name": "Hacked"}})
    assert res.status_code == 404


def test_get_one_mine_returns_own(client, db_session):
    csrf = _contrib_login(client, db_session)
    client.post("/api/doctors", headers={"X-CSRF-Token": csrf}, json={"name": "Fetch Me"})
    sid = client.get("/api/submissions/mine").json()[0]["id"]
    res = client.get(f"/api/submissions/{sid}")
    assert res.status_code == 200
    assert res.json()["payload"]["name"] == "Fetch Me"


def test_get_one_mine_404_for_others(client, db_session):
    csrf1 = _contrib_login(client, db_session)
    client.post("/api/doctors", headers={"X-CSRF-Token": csrf1}, json={"name": "C1"})
    sid = client.get("/api/submissions/mine").json()[0]["id"]
    _contrib_login(client, db_session)  # switch to a different contributor
    assert client.get(f"/api/submissions/{sid}").status_code == 404
