# backend/tests/test_visit_call_procedure_types.py
"""visit_type (visit_logs) and procedure_type (surgeries) behavior."""
from app.models.user import Role
from app.services import user_service


def _admin(client, db):
    user_service.create_user(db, "admin@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "admin@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def test_visit_type_defaults_to_in_person(client, db_session):
    csrf = _admin(client, db_session)
    r = client.post("/api/visit-logs", headers={"X-CSRF-Token": csrf}, json={"reason": "Checkup"})
    assert r.status_code == 201, r.text
    assert r.json()["visit_type"] == "in_person"


def test_visit_type_accepts_phone_call_and_updates(client, db_session):
    csrf = _admin(client, db_session)
    r = client.post("/api/visit-logs", headers={"X-CSRF-Token": csrf},
                    json={"reason": "Med question", "visit_type": "phone_call"})
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    assert r.json()["visit_type"] == "phone_call"
    r = client.put(f"/api/visit-logs/{rid}", headers={"X-CSRF-Token": csrf},
                   json={"visit_type": "telehealth"})
    assert r.status_code == 200, r.text
    assert r.json()["visit_type"] == "telehealth"


def test_visit_type_rejects_invalid(client, db_session):
    csrf = _admin(client, db_session)
    r = client.post("/api/visit-logs", headers={"X-CSRF-Token": csrf},
                    json={"reason": "x", "visit_type": "carrier_pigeon"})
    assert r.status_code == 422


def test_calendar_prefixes_call_titles(client, db_session):
    csrf = _admin(client, db_session)
    client.post("/api/visit-logs", headers={"X-CSRF-Token": csrf},
                json={"reason": "Lab results", "visit_date": "2026-07-10", "visit_type": "phone_call"})
    client.post("/api/visit-logs", headers={"X-CSRF-Token": csrf},
                json={"visit_date": "2026-07-11", "visit_type": "telehealth"})
    client.post("/api/visit-logs", headers={"X-CSRF-Token": csrf},
                json={"reason": "Annual", "visit_date": "2026-07-12"})
    titles = {e["title"] for e in client.get("/api/calendar/events").json() if e["type"] == "visit_log"}
    assert "Call: Lab results" in titles
    assert "Call" in titles
    assert "Annual" in titles


def test_procedure_type_defaults_to_surgery(client, db_session):
    csrf = _admin(client, db_session)
    r = client.post("/api/surgeries", headers={"X-CSRF-Token": csrf}, json={"procedure": "Appendectomy"})
    assert r.status_code == 201, r.text
    assert r.json()["procedure_type"] == "surgery"


def test_procedure_type_accepts_outpatient_clinic_and_updates(client, db_session):
    csrf = _admin(client, db_session)
    r = client.post("/api/surgeries", headers={"X-CSRF-Token": csrf},
                    json={"procedure": "Mole removal", "procedure_type": "outpatient"})
    assert r.status_code == 201, r.text
    rid = r.json()["id"]
    assert r.json()["procedure_type"] == "outpatient"
    r = client.put(f"/api/surgeries/{rid}", headers={"X-CSRF-Token": csrf},
                   json={"procedure_type": "clinic"})
    assert r.status_code == 200, r.text
    assert r.json()["procedure_type"] == "clinic"


def test_procedure_type_rejects_invalid(client, db_session):
    csrf = _admin(client, db_session)
    r = client.post("/api/surgeries", headers={"X-CSRF-Token": csrf},
                    json={"procedure": "x", "procedure_type": "house_call"})
    assert r.status_code == 422
