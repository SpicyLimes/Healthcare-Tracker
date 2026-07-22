# backend/tests/test_summary.py
"""One-Page Summary: schema, admin render, guest scoping."""
from datetime import datetime, timedelta, timezone

from app.schemas.summary import SummaryRequest
from app.services import summary_service


def test_summary_request_defaults():
    req = SummaryRequest(sections=["doctors"])
    assert req.sections == ["doctors"]
    assert req.include_patient_header is True
    assert req.date_from is None
    assert req.date_to is None
    assert req.prepared_for is None
    assert req.title == "Patient Health Summary"


def test_section_map_has_all_sections():
    section_map = summary_service.get_section_map()
    # Same 16 sections the guest router exposes
    assert set(section_map.keys()) == {
        "medications", "doctors", "ailments", "profile", "surgeries",
        "hospitalizations", "vision_history", "dental_history", "visit_logs",
        "vitals", "appointments", "vaccinations", "insurances", "pharmacies",
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


def _login_viewer(client, db_session, email="viewersum@example.com"):
    from app.models.user import Role
    from app.services import user_service
    user_service.create_user(db_session, email, "a-strong-passphrase-123", Role.viewer)
    client.post("/api/auth/login", json={"email": email, "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def test_viewer_can_generate_summary(client, db_session):
    admin_csrf = _login_admin(client, db_session, email="seedadmin@example.com")
    client.post("/api/doctors", headers={"X-CSRF-Token": admin_csrf}, json={"name": "Dr. ViewerSees"})
    client.post("/api/auth/logout", headers={"X-CSRF-Token": admin_csrf})

    csrf = _login_viewer(client, db_session)
    r = client.post(
        "/api/summary",
        headers={"X-CSRF-Token": csrf},
        json={"sections": ["doctors"]},
    )
    assert r.status_code == 200, r.text
    assert "Dr. ViewerSees" in r.text


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


def test_admin_summary_applies_date_range_from_json(client, db_session):
    from datetime import date, datetime, timezone
    from app.models.doctor import Doctor

    csrf = _login_admin(client, db_session, email="daterange@example.com")
    old = Doctor(name="Old Range Doc")
    new = Doctor(name="New Range Doc")
    db_session.add_all([old, new])
    db_session.flush()
    old.created_at = datetime(2020, 1, 1, tzinfo=timezone.utc)
    new.created_at = datetime(2026, 6, 1, tzinfo=timezone.utc)
    db_session.flush()

    r = client.post(
        "/api/summary",
        headers={"X-CSRF-Token": csrf},
        json={"sections": ["doctors"], "date_from": "2026-01-01", "date_to": str(date(2026, 12, 31))},
    )
    assert r.status_code == 200
    assert "New Range Doc" in r.text
    assert "Old Range Doc" not in r.text


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


def test_guest_summary_403_when_no_granted_sections(client, db_session):
    csrf = _login_admin(client, db_session, email="nogrant@example.com")
    client.post("/api/medications", headers={"X-CSRF-Token": csrf}, json={"name": "SecretMed"})
    token = _make_link(client, csrf, ["doctors"])  # granted: doctors only
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})

    # Guest scoped to doctors requests ONLY medications -> nothing granted
    r = client.post(f"/api/summary/guest?token={token}", json={"sections": ["medications"]})
    assert r.status_code == 403
    assert "SecretMed" not in r.text


def test_guest_summary_rejects_revoked_token(client, db_session):
    csrf = _login_admin(client, db_session, email="revoke@example.com")
    expires = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    create = client.post(
        "/api/share-links",
        headers={"X-CSRF-Token": csrf},
        json={"label": "Rev", "expires_at": expires, "allowed_sections": ["doctors"]},
    )
    assert create.status_code == 201
    body = create.json()
    link_id = body["id"]
    token = body["token_url"].split("token=")[1]
    # revoke it: DELETE /api/share-links/{link_id} sets revoked=True (204 No Content)
    revoke = client.request(
        "DELETE",
        f"/api/share-links/{link_id}",
        headers={"X-CSRF-Token": csrf},
    )
    assert revoke.status_code in (200, 204)
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})

    r = client.post(f"/api/summary/guest?token={token}", json={"sections": ["doctors"]})
    assert r.status_code == 403  # get_guest_access raises 403 for revoked links


def test_guest_summary_empty_link_grants_all_sections(client, db_session):
    """Empty allowed_sections in share link grants guest access to ALL sections."""
    csrf = _login_admin(client, db_session, email="emptylinkadmin@example.com")
    client.post("/api/doctors", headers={"X-CSRF-Token": csrf}, json={"name": "AllAccessDoc"})
    client.post("/api/medications", headers={"X-CSRF-Token": csrf}, json={"name": "AllAccessMed"})
    token = _make_link(client, csrf, [])  # empty == all sections
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})

    # Guest requests both doctors and medications; both should be granted
    r = client.post(
        f"/api/summary/guest?token={token}",
        json={"sections": ["doctors", "medications"]},
    )
    assert r.status_code == 200, r.text
    assert "AllAccessDoc" in r.text
    assert "AllAccessMed" in r.text


def test_gather_visit_logs_with_linked_vitals_validates(client, db_session):
    """Regression: a Visit Log linked to a Vitals row must gather without error.

    VisitLogResponse declares all nine vitals fields (bp/pulse/height/weight/temp/
    resp/spo2/glucose). gather_section_rows must attach ALL of them from the linked
    Vitals row before model_validate — attaching only bp/pulse left the other six as
    missing attributes, so model_validate raised and the whole summary 500'd
    ("Could not generate the summary").
    """
    csrf = _login_admin(client, db_session, email="visitvitals@example.com")
    r = client.post(
        "/api/visit-logs",
        headers={"X-CSRF-Token": csrf},
        json={
            "visit_type": "in_person",
            "reason": "Checkup",
            "bp_systolic": 120,
            "bp_diastolic": 80,
            "pulse_bpm": 72,
            "weight_lb": 150.0,
            "temperature_f": 98.6,
        },
    )
    assert r.status_code == 201, r.text

    rows = summary_service.gather_section_rows(db_session, "visit_logs", date_from=None, date_to=None)
    assert len(rows) == 1
    assert rows[0]["bp_systolic"] == 120
    assert rows[0]["weight_lb"] == 150.0


def test_gather_visit_logs_without_linked_vitals_validates(client, db_session):
    """A Visit Log with no linked Vitals must still gather (all vitals fields None)."""
    csrf = _login_admin(client, db_session, email="visitnovitals@example.com")
    r = client.post(
        "/api/visit-logs",
        headers={"X-CSRF-Token": csrf},
        json={"visit_type": "phone_call", "reason": "Phone follow-up"},
    )
    assert r.status_code == 201, r.text

    rows = summary_service.gather_section_rows(db_session, "visit_logs", date_from=None, date_to=None)
    assert len(rows) == 1
    assert rows[0]["bp_systolic"] is None
    assert rows[0]["weight_lb"] is None


def test_admin_summary_all_sections_renders(client, db_session):
    """Selecting every section (as 'All Records' does) must render, not 500.

    Guards against any section whose response schema references attributes the
    gather step doesn't populate — the class of bug that made visit_logs fail.
    """
    csrf = _login_admin(client, db_session, email="allsections@example.com")
    section_map = summary_service.get_section_map()
    all_sections = list(section_map.keys())
    r = client.post(
        "/api/summary",
        headers={"X-CSRF-Token": csrf},
        json={"sections": all_sections},
    )
    assert r.status_code == 200, r.text
    assert "text/html" in r.headers["content-type"]


def test_summary_uses_current_section_titles():
    """Renamed features must print their current names, not the old ones."""
    req = SummaryRequest(sections=["surgeries", "visit_logs"], include_patient_header=False)
    html = summary_service.render_summary(
        req, {"surgeries": [], "visit_logs": []}, patient=None
    )
    assert "Procedures" in html
    assert ">Surgeries<" not in html
    assert "Visit &amp; Call Logs" in html or "Visit & Call Logs" in html


def test_summary_renders_friendly_enum_labels(client, db_session):
    """visit_type / procedure_type print app-style labels, not raw stored keys."""
    csrf = _login_admin(client, db_session, email="enumlabels@example.com")
    client.post(
        "/api/visit-logs",
        headers={"X-CSRF-Token": csrf},
        json={"visit_type": "phone_call", "reason": "Call"},
    )
    client.post(
        "/api/surgeries",
        headers={"X-CSRF-Token": csrf},
        json={"procedure": "Scope", "procedure_type": "outpatient"},
    )
    r = client.post(
        "/api/summary",
        headers={"X-CSRF-Token": csrf},
        json={"sections": ["visit_logs", "surgeries"]},
    )
    assert r.status_code == 200, r.text
    assert "Phone Call" in r.text
    assert "Out-Patient" in r.text
    # raw keys must not appear as cell values
    assert ">phone_call<" not in r.text
    assert ">outpatient<" not in r.text


def test_summary_excludes_inactive_insurance(client, db_session):
    csrf = _login_admin(client, db_session, email="inssummary@example.com")
    h = {"X-CSRF-Token": csrf}
    client.post("/api/insurances", headers=h, json={"insurer_name": "ActiveIns"})
    client.post("/api/insurances", headers=h, json={"insurer_name": "InactiveIns", "is_active": False})

    r = client.post("/api/summary", headers=h, json={"sections": ["insurances"]})
    assert r.status_code == 200, r.text
    assert "ActiveIns" in r.text
    assert "InactiveIns" not in r.text


def test_summary_medications_show_pharmacy_and_resolved_doctor(client, db_session):
    from app.models.doctor import Doctor
    from app.models.extended_records import Pharmacy
    from app.models.medication import Medication
    from app.schemas.summary import SummaryRequest

    p = Pharmacy(name="Summary Pharm")
    d = Doctor(name="Dr. Summary")
    db_session.add_all([p, d])
    db_session.commit()
    db_session.add(Medication(name="SummaryMed", pharmacy_id=p.id, prescribing_doctor_id=d.id))
    db_session.commit()

    rows = summary_service.gather_section_rows(db_session, "medications", date_from=None, date_to=None)
    req = SummaryRequest(sections=["medications"], include_patient_header=False)
    html = summary_service.render_summary(req, {"medications": rows}, patient=None)

    assert "Summary Pharm" in html
    assert "Dr. Summary" in html
    # Raw UUIDs must stay hidden
    assert str(p.id) not in html
