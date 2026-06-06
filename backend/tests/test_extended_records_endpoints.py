# backend/tests/test_extended_records_endpoints.py
"""Endpoint tests for all 10 Phase 4 record sections."""
import uuid

from app.models.user import Role
from app.services import user_service


def _admin(client, db):
    user_service.create_user(db, "admin@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "admin@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def _viewer(client, db):
    user_service.create_user(db, "viewer@example.com", "a-strong-passphrase-123", Role.viewer)
    client.post("/api/auth/login", json={"email": "viewer@example.com", "password": "a-strong-passphrase-123"})


# ---------------------------------------------------------------------------
# Generic helpers — run the standard 6 assertions for any list section
# ---------------------------------------------------------------------------

def _crud_suite(client, db, prefix: str, create_payload: dict, update_payload: dict, updated_field: str, updated_value):
    """Full CRUD + viewer + CSRF + 404 + 422 for one section."""
    csrf = _admin(client, db)

    # create
    r = client.post(prefix, headers={"X-CSRF-Token": csrf}, json=create_payload)
    assert r.status_code == 201, r.text
    rid = r.json()["id"]

    # list
    assert client.get(prefix).status_code == 200

    # get by id
    r = client.get(f"{prefix}/{rid}")
    assert r.status_code == 200

    # update
    r = client.put(f"{prefix}/{rid}", headers={"X-CSRF-Token": csrf}, json=update_payload)
    assert r.status_code == 200
    assert r.json()[updated_field] == updated_value

    # delete
    assert client.delete(f"{prefix}/{rid}", headers={"X-CSRF-Token": csrf}).status_code == 204
    assert client.get(f"{prefix}/{rid}").status_code == 404


def _auth_suite(client, db, prefix: str, create_payload: dict):
    """viewer read-only / CSRF-less write blocked / unauthenticated read blocked."""
    csrf = _admin(client, db)
    client.post(prefix, headers={"X-CSRF-Token": csrf}, json=create_payload)
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})

    _viewer(client, db)
    viewer_csrf = client.cookies.get("csrf_token")
    assert client.get(prefix).status_code == 200
    assert client.post(prefix, json=create_payload).status_code == 403
    client.post("/api/auth/logout", headers={"X-CSRF-Token": viewer_csrf})

    # Unauthenticated access is blocked
    assert client.get(prefix).status_code == 401


def _404_suite(client, db, prefix: str, update_payload: dict):
    csrf = _admin(client, db)
    missing = uuid.uuid4()
    assert client.put(f"{prefix}/{missing}", headers={"X-CSRF-Token": csrf}, json=update_payload).status_code == 404
    assert client.delete(f"{prefix}/{missing}", headers={"X-CSRF-Token": csrf}).status_code == 404


# ---------------------------------------------------------------------------
# Insurance
# ---------------------------------------------------------------------------

def test_insurances_crud(client, db_session):
    _crud_suite(client, db_session, "/api/insurances",
                {"insurer_name": "BlueCross"}, {"policy_number": "X123"}, "policy_number", "X123")

def test_insurances_auth(client, db_session):
    _auth_suite(client, db_session, "/api/insurances", {"insurer_name": "BlueCross"})

def test_insurances_404(client, db_session):
    _404_suite(client, db_session, "/api/insurances", {"policy_number": "x"})

def test_insurances_422(client, db_session):
    csrf = _admin(client, db_session)
    assert client.post("/api/insurances", headers={"X-CSRF-Token": csrf}, json={}).status_code == 422


# ---------------------------------------------------------------------------
# Pharmacy
# ---------------------------------------------------------------------------

def test_pharmacies_crud(client, db_session):
    _crud_suite(client, db_session, "/api/pharmacies",
                {"name": "CVS"}, {"phone": "555-1234"}, "phone", "555-1234")

def test_pharmacies_auth(client, db_session):
    _auth_suite(client, db_session, "/api/pharmacies", {"name": "CVS"})

def test_pharmacies_404(client, db_session):
    _404_suite(client, db_session, "/api/pharmacies", {"phone": "x"})

def test_pharmacies_422(client, db_session):
    csrf = _admin(client, db_session)
    assert client.post("/api/pharmacies", headers={"X-CSRF-Token": csrf}, json={}).status_code == 422


# ---------------------------------------------------------------------------
# Family History
# ---------------------------------------------------------------------------

def test_family_history_crud(client, db_session):
    _crud_suite(client, db_session, "/api/family-history",
                {"relative": "Mother", "condition": "Diabetes"},
                {"age_of_onset": "early 50s"}, "age_of_onset", "early 50s")

def test_family_history_auth(client, db_session):
    _auth_suite(client, db_session, "/api/family-history", {"relative": "Mother", "condition": "Diabetes"})

def test_family_history_404(client, db_session):
    _404_suite(client, db_session, "/api/family-history", {"age_of_onset": "x"})

def test_family_history_422(client, db_session):
    csrf = _admin(client, db_session)
    # missing required 'condition'
    assert client.post("/api/family-history", headers={"X-CSRF-Token": csrf}, json={"relative": "Mother"}).status_code == 422


# ---------------------------------------------------------------------------
# Surgery
# ---------------------------------------------------------------------------

def test_surgeries_crud(client, db_session):
    _crud_suite(client, db_session, "/api/surgeries",
                {"procedure": "Appendectomy"}, {"hospital": "Mass General"}, "hospital", "Mass General")

def test_surgeries_auth(client, db_session):
    _auth_suite(client, db_session, "/api/surgeries", {"procedure": "Appendectomy"})

def test_surgeries_404(client, db_session):
    _404_suite(client, db_session, "/api/surgeries", {"hospital": "x"})

def test_surgeries_422(client, db_session):
    csrf = _admin(client, db_session)
    assert client.post("/api/surgeries", headers={"X-CSRF-Token": csrf}, json={}).status_code == 422

def test_surgeries_doctor_fk_set_null(client, db_session):
    """Deleting a doctor sets surgeon_id to NULL rather than cascading."""
    csrf = _admin(client, db_session)
    doc = client.post("/api/doctors", headers={"X-CSRF-Token": csrf}, json={"name": "Dr. Smith"})
    assert doc.status_code == 201
    doc_id = doc.json()["id"]
    surg = client.post("/api/surgeries", headers={"X-CSRF-Token": csrf},
                       json={"procedure": "Hip replacement", "surgeon_id": doc_id})
    assert surg.status_code == 201
    surg_id = surg.json()["id"]
    assert client.delete(f"/api/doctors/{doc_id}", headers={"X-CSRF-Token": csrf}).status_code == 204
    r = client.get(f"/api/surgeries/{surg_id}")
    assert r.status_code == 200
    assert r.json()["surgeon_id"] is None


# ---------------------------------------------------------------------------
# Hospitalization
# ---------------------------------------------------------------------------

def test_hospitalizations_crud(client, db_session):
    _crud_suite(client, db_session, "/api/hospitalizations",
                {"facility": "Mass General"}, {"reason": "Chest pain"}, "reason", "Chest pain")

def test_hospitalizations_auth(client, db_session):
    _auth_suite(client, db_session, "/api/hospitalizations", {"facility": "Mass General"})

def test_hospitalizations_404(client, db_session):
    _404_suite(client, db_session, "/api/hospitalizations", {"reason": "x"})

def test_hospitalizations_422(client, db_session):
    csrf = _admin(client, db_session)
    assert client.post("/api/hospitalizations", headers={"X-CSRF-Token": csrf}, json={}).status_code == 422

def test_hospitalizations_doctor_fk_set_null(client, db_session):
    csrf = _admin(client, db_session)
    doc = client.post("/api/doctors", headers={"X-CSRF-Token": csrf}, json={"name": "Dr. Jones"})
    assert doc.status_code == 201
    doc_id = doc.json()["id"]
    hosp = client.post("/api/hospitalizations", headers={"X-CSRF-Token": csrf},
                       json={"facility": "City Hospital", "attending_physician_id": doc_id})
    assert hosp.status_code == 201
    hosp_id = hosp.json()["id"]
    assert client.delete(f"/api/doctors/{doc_id}", headers={"X-CSRF-Token": csrf}).status_code == 204
    r = client.get(f"/api/hospitalizations/{hosp_id}")
    assert r.status_code == 200
    assert r.json()["attending_physician_id"] is None


# ---------------------------------------------------------------------------
# Vision History
# ---------------------------------------------------------------------------

def test_vision_history_crud(client, db_session):
    _crud_suite(client, db_session, "/api/vision-history",
                {"rx_od": "-2.00"}, {"rx_os": "-1.75"}, "rx_os", "-1.75")

def test_vision_history_auth(client, db_session):
    _auth_suite(client, db_session, "/api/vision-history", {"rx_od": "-2.00"})

def test_vision_history_404(client, db_session):
    _404_suite(client, db_session, "/api/vision-history", {"rx_od": "x"})

def test_vision_history_doctor_fk_set_null(client, db_session):
    csrf = _admin(client, db_session)
    doc = client.post("/api/doctors", headers={"X-CSRF-Token": csrf}, json={"name": "Dr. Eyes"})
    assert doc.status_code == 201
    doc_id = doc.json()["id"]
    vis = client.post("/api/vision-history", headers={"X-CSRF-Token": csrf},
                      json={"provider_id": doc_id})
    assert vis.status_code == 201
    vis_id = vis.json()["id"]
    assert client.delete(f"/api/doctors/{doc_id}", headers={"X-CSRF-Token": csrf}).status_code == 204
    r = client.get(f"/api/vision-history/{vis_id}")
    assert r.status_code == 200
    assert r.json()["provider_id"] is None


# ---------------------------------------------------------------------------
# Dental History
# ---------------------------------------------------------------------------

def test_dental_history_crud(client, db_session):
    _crud_suite(client, db_session, "/api/dental-history",
                {"procedure": "Cleaning"}, {"notes": "no cavities"}, "notes", "no cavities")

def test_dental_history_auth(client, db_session):
    _auth_suite(client, db_session, "/api/dental-history", {"procedure": "Cleaning"})

def test_dental_history_404(client, db_session):
    _404_suite(client, db_session, "/api/dental-history", {"notes": "x"})

def test_dental_history_doctor_fk_set_null(client, db_session):
    csrf = _admin(client, db_session)
    doc = client.post("/api/doctors", headers={"X-CSRF-Token": csrf}, json={"name": "Dr. Teeth"})
    assert doc.status_code == 201
    doc_id = doc.json()["id"]
    den = client.post("/api/dental-history", headers={"X-CSRF-Token": csrf},
                      json={"provider_id": doc_id})
    assert den.status_code == 201
    den_id = den.json()["id"]
    assert client.delete(f"/api/doctors/{doc_id}", headers={"X-CSRF-Token": csrf}).status_code == 204
    r = client.get(f"/api/dental-history/{den_id}")
    assert r.status_code == 200
    assert r.json()["provider_id"] is None


# ---------------------------------------------------------------------------
# Vaccinations
# ---------------------------------------------------------------------------

def test_vaccinations_crud(client, db_session):
    _crud_suite(client, db_session, "/api/vaccinations",
                {"vaccine": "Flu"}, {"lot_number": "ABC123"}, "lot_number", "ABC123")

def test_vaccinations_auth(client, db_session):
    _auth_suite(client, db_session, "/api/vaccinations", {"vaccine": "Flu"})

def test_vaccinations_404(client, db_session):
    _404_suite(client, db_session, "/api/vaccinations", {"lot_number": "x"})

def test_vaccinations_422(client, db_session):
    csrf = _admin(client, db_session)
    assert client.post("/api/vaccinations", headers={"X-CSRF-Token": csrf}, json={}).status_code == 422


# ---------------------------------------------------------------------------
# Visit Logs
# ---------------------------------------------------------------------------

def test_visit_logs_crud(client, db_session):
    _crud_suite(client, db_session, "/api/visit-logs",
                {"reason": "Annual checkup"}, {"summary": "All clear"}, "summary", "All clear")

def test_visit_logs_auth(client, db_session):
    _auth_suite(client, db_session, "/api/visit-logs", {"reason": "Annual checkup"})

def test_visit_logs_404(client, db_session):
    _404_suite(client, db_session, "/api/visit-logs", {"summary": "x"})

def test_visit_logs_doctor_fk_set_null(client, db_session):
    csrf = _admin(client, db_session)
    doc = client.post("/api/doctors", headers={"X-CSRF-Token": csrf}, json={"name": "Dr. Primary"})
    assert doc.status_code == 201
    doc_id = doc.json()["id"]
    vl = client.post("/api/visit-logs", headers={"X-CSRF-Token": csrf},
                     json={"doctor_id": doc_id, "reason": "Follow-up"})
    assert vl.status_code == 201
    vl_id = vl.json()["id"]
    assert client.delete(f"/api/doctors/{doc_id}", headers={"X-CSRF-Token": csrf}).status_code == 204
    r = client.get(f"/api/visit-logs/{vl_id}")
    assert r.status_code == 200
    assert r.json()["doctor_id"] is None


# ---------------------------------------------------------------------------
# Appointments
# ---------------------------------------------------------------------------

def test_appointments_crud(client, db_session):
    _crud_suite(client, db_session, "/api/appointments",
                {"appointment_datetime": "2026-07-01T10:00:00Z"},
                {"status": "completed"}, "status", "completed")

def test_appointments_auth(client, db_session):
    _auth_suite(client, db_session, "/api/appointments",
                {"appointment_datetime": "2026-07-01T10:00:00Z"})

def test_appointments_404(client, db_session):
    _404_suite(client, db_session, "/api/appointments", {"status": "cancelled"})

def test_appointments_422(client, db_session):
    csrf = _admin(client, db_session)
    assert client.post("/api/appointments", headers={"X-CSRF-Token": csrf}, json={}).status_code == 422

def test_appointments_doctor_fk_set_null(client, db_session):
    csrf = _admin(client, db_session)
    doc = client.post("/api/doctors", headers={"X-CSRF-Token": csrf}, json={"name": "Dr. Appt"})
    assert doc.status_code == 201
    doc_id = doc.json()["id"]
    appt = client.post("/api/appointments", headers={"X-CSRF-Token": csrf},
                       json={"appointment_datetime": "2026-08-01T09:00:00Z", "doctor_id": doc_id})
    assert appt.status_code == 201
    appt_id = appt.json()["id"]
    assert client.delete(f"/api/doctors/{doc_id}", headers={"X-CSRF-Token": csrf}).status_code == 204
    r = client.get(f"/api/appointments/{appt_id}")
    assert r.status_code == 200
    assert r.json()["doctor_id"] is None


# ---------------------------------------------------------------------------
# New field round-trip tests
# ---------------------------------------------------------------------------

def test_profile_height_weight_phone_round_trip(client, db_session):
    user_service.create_user(db_session, "profiletest@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "profiletest@example.com", "password": "a-strong-passphrase-123"})
    csrf = client.cookies.get("csrf_token")
    r = client.put(
        "/api/profile",
        headers={"X-CSRF-Token": csrf},
        json={"full_name": "Test Patient", "height": "5'6\"", "weight": "140 lbs", "phone": "555-0100"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["height"] == "5'6\""
    assert body["weight"] == "140 lbs"
    assert body["phone"] == "555-0100"


def test_medication_route_round_trip(client, db_session):
    user_service.create_user(db_session, "medroute@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "medroute@example.com", "password": "a-strong-passphrase-123"})
    csrf = client.cookies.get("csrf_token")
    r = client.post(
        "/api/medications",
        headers={"X-CSRF-Token": csrf},
        json={"name": "Lisinopril", "route": "oral"},
    )
    assert r.status_code == 201
    assert r.json()["route"] == "oral"


def test_vaccination_manufacturer_round_trip(client, db_session):
    user_service.create_user(db_session, "vacmfr@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "vacmfr@example.com", "password": "a-strong-passphrase-123"})
    csrf = client.cookies.get("csrf_token")
    r = client.post(
        "/api/vaccinations",
        headers={"X-CSRF-Token": csrf},
        json={"vaccine": "Influenza", "manufacturer": "Pfizer"},
    )
    assert r.status_code == 201
    assert r.json()["manufacturer"] == "Pfizer"


def test_appointment_type_round_trip(client, db_session):
    from datetime import datetime, timedelta, timezone
    user_service.create_user(db_session, "appttype@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "appttype@example.com", "password": "a-strong-passphrase-123"})
    csrf = client.cookies.get("csrf_token")
    dt = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    r = client.post(
        "/api/appointments",
        headers={"X-CSRF-Token": csrf},
        json={"appointment_datetime": dt, "appointment_type": "specialist"},
    )
    assert r.status_code == 201
    assert r.json()["appointment_type"] == "specialist"
