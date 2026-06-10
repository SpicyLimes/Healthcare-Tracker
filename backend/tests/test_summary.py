# backend/tests/test_summary.py
"""One-Page Summary: schema, admin render, guest scoping."""
from datetime import datetime, timedelta, timezone

from app.schemas.summary import SummaryRequest
from app.services import summary_service


def test_summary_request_defaults():
    req = SummaryRequest(sections=["doctors"])
    assert req.sections == ["doctors"]
    assert req.include_patient_header is True
    assert req.include_documents is False
    assert req.date_from is None
    assert req.date_to is None
    assert req.prepared_for is None
    assert req.title == "Patient Health Summary"


def test_section_map_has_all_sections():
    section_map = summary_service.get_section_map()
    # Same 15 sections the guest router exposes
    assert set(section_map.keys()) == {
        "medications", "doctors", "ailments", "profile", "surgeries",
        "hospitalizations", "vision_history", "dental_history", "visit_logs",
        "appointments", "vaccinations", "insurances", "pharmacies",
        "family_history", "nutrition_plan",
    }


def test_gather_section_rows_returns_dicts(client, db_session):
    # Seed one doctor via the admin API so a row exists
    from app.models.user import Role
    from app.services import user_service
    user_service.create_user(db_session, "sumadmin@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "sumadmin@example.com", "password": "a-strong-passphrase-123"})
    csrf = client.cookies.get("csrf_token")
    client.post("/api/doctors", headers={"X-CSRF-Token": csrf}, json={"name": "Dr. Render Test"})

    rows = summary_service.gather_section_rows(db_session, "doctors", date_from=None, date_to=None)
    assert isinstance(rows, list)
    assert any(r.get("name") == "Dr. Render Test" for r in rows)
    # id and *_id columns are stringified but present; renderer filters them later
    assert all(isinstance(r, dict) for r in rows)


def test_gather_section_rows_filters_by_date(client, db_session):
    from datetime import date, datetime, timezone
    from app.models.doctor import Doctor
    from app.models.user import Role
    from app.services import user_service

    admin = user_service.create_user(db_session, "datefilter@example.com", "a-strong-passphrase-123", Role.admin)

    old = Doctor(name="Old Doc", created_by=admin.id)
    new = Doctor(name="New Doc", created_by=admin.id)
    db_session.add_all([old, new])
    db_session.flush()
    old.created_at = datetime(2020, 1, 1, tzinfo=timezone.utc)
    new.created_at = datetime(2026, 6, 1, tzinfo=timezone.utc)
    db_session.flush()

    rows = summary_service.gather_section_rows(
        db_session, "doctors", date_from=date(2026, 1, 1), date_to=None
    )
    names = {r.get("name") for r in rows}
    assert "New Doc" in names
    assert "Old Doc" not in names


def test_render_summary_includes_selected_section_and_excludes_others():
    req = SummaryRequest(sections=["doctors"], prepared_for="Dr. Smith")
    section_data = {
        "doctors": [
            {"id": "x", "name": "Dr. A", "specialty": "Cardiology", "created_at": "2026-01-01T00:00:00Z"}
        ]
    }
    html = summary_service.render_summary(req, section_data, patient=None)
    assert "<!DOCTYPE html>" in html
    assert "Patient Health Summary" in html
    assert "Prepared for: Dr. Smith" in html
    assert "Dr. A" in html
    assert "Cardiology" in html
    # generic renderer hides id and timestamp columns
    assert ">id<" not in html
    assert "created_at" not in html
    # a non-selected section must not appear
    assert "Medications" not in html
    assert "@media print" in html


def test_render_summary_patient_header_optional():
    req = SummaryRequest(sections=["doctors"], include_patient_header=True)
    patient = {"full_name": "Jane Doe", "date_of_birth": "1950-01-02"}
    html = summary_service.render_summary(req, {"doctors": []}, patient=patient)
    assert "Jane Doe" in html

    req_no = SummaryRequest(sections=["doctors"], include_patient_header=False)
    html_no = summary_service.render_summary(req_no, {"doctors": []}, patient=patient)
    assert "Jane Doe" not in html_no


def _login_admin(client, db_session, email="endpadmin@example.com"):
    from app.models.user import Role
    from app.services import user_service
    user_service.create_user(db_session, email, "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": email, "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def test_admin_summary_renders_html(client, db_session):
    csrf = _login_admin(client, db_session)
    client.post("/api/doctors", headers={"X-CSRF-Token": csrf}, json={"name": "Dr. Endpoint"})
    r = client.post(
        "/api/summary",
        headers={"X-CSRF-Token": csrf},
        json={"sections": ["doctors"], "prepared_for": "Dr. Referral"},
    )
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]
    assert "Dr. Endpoint" in r.text
    assert "Prepared for: Dr. Referral" in r.text


def test_admin_summary_requires_auth(client, db_session):
    r = client.post("/api/summary", json={"sections": ["doctors"]})
    assert r.status_code == 401


def test_admin_summary_requires_csrf(client, db_session):
    _login_admin(client, db_session, email="csrfcheck@example.com")
    r = client.post("/api/summary", json={"sections": ["doctors"]})  # no X-CSRF-Token header
    assert r.status_code == 403


def test_admin_summary_rejects_empty_sections(client, db_session):
    csrf = _login_admin(client, db_session, email="emptysec@example.com")
    r = client.post("/api/summary", headers={"X-CSRF-Token": csrf}, json={"sections": []})
    assert r.status_code == 422


def _make_link(client, csrf, sections):
    expires = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    r = client.post(
        "/api/share-links",
        headers={"X-CSRF-Token": csrf},
        json={"label": "Sum", "expires_at": expires, "allowed_sections": sections},
    )
    assert r.status_code == 201
    return r.json()["token_url"].split("token=")[1]


def test_guest_summary_only_renders_granted_sections(client, db_session):
    csrf = _login_admin(client, db_session, email="guestsumadmin@example.com")
    client.post("/api/doctors", headers={"X-CSRF-Token": csrf}, json={"name": "Granted Doc"})
    client.post("/api/medications", headers={"X-CSRF-Token": csrf}, json={"name": "SecretMed"})
    token = _make_link(client, csrf, ["doctors"])
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})

    # Guest requests BOTH doctors (granted) and medications (NOT granted)
    r = client.post(
        f"/api/summary/guest?token={token}",
        json={"sections": ["doctors", "medications"]},
    )
    assert r.status_code == 200
    assert "Granted Doc" in r.text
    # The ungranted section's data must NOT leak
    assert "SecretMed" not in r.text
    assert "Medications" not in r.text


def test_guest_summary_rejects_invalid_token(client, db_session):
    r = client.post("/api/summary/guest?token=bogus", json={"sections": ["doctors"]})
    assert r.status_code == 401
