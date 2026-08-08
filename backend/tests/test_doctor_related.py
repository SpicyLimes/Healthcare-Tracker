# backend/tests/test_doctor_related.py
"""GET /api/doctors/{id}/related — the reverse lookup behind the doctor lens.

A doctor was a row of contact details. "What has this doctor prescribed,
treated, and operated on?" meant opening eight pages and reading each for the
name, even though nine role-typed FKs already held the answer.
"""
import uuid
from datetime import date, datetime, timezone

from app.models.ailment import Ailment
from app.models.doctor import Doctor
from app.models.extended_records import (
    Appointment, DentalHistory, Hospitalization, Surgery, VisionHistory, VisitLog,
)
from app.models.medication import Medication
from app.models.profile import Profile
from app.models.user import Role
from app.services import user_service


def _admin(db):
    u = user_service.create_user(db, "rel@example.com", "a-strong-passphrase-123", Role.admin)
    db.flush()
    return u


def _login(client):
    client.post("/api/auth/login", json={"email": "rel@example.com", "password": "a-strong-passphrase-123"})


def _doctor(db, u, name="Dr. Nadar"):
    d = Doctor(created_by=u.id, name=name, specialty="Internal Medicine")
    db.add(d)
    db.flush()
    return d


def test_related_groups_by_clinical_role(client, db_session):
    """The role labels are the feature — a flat list would lose the meaning."""
    u = _admin(db_session)
    doc = _doctor(db_session, u)

    db_session.add(Medication(created_by=u.id, name="Metformin", dose="500mg",
                              prescribing_doctor_id=doc.id, start_date=date(2025, 1, 1)))
    db_session.add(Surgery(created_by=u.id, procedure="Knee replacement",
                           surgeon_id=doc.id, surgery_date=date(2024, 6, 1)))
    db_session.add(Hospitalization(created_by=u.id, facility="City Hospital", reason="Pneumonia",
                                   attending_physician_id=doc.id, admission_date=date(2024, 2, 1)))
    db_session.flush()

    _login(client)
    r = client.get(f"/api/doctors/{doc.id}/related")
    assert r.status_code == 200
    groups = {g["role"]: g for g in r.json()}

    assert set(groups) == {"Prescriber", "Surgeon", "Attending"}
    assert groups["Prescriber"]["count"] == 1
    assert groups["Prescriber"]["items"][0]["title"] == "Metformin — 500mg"
    assert groups["Prescriber"]["section"] == "medications"
    assert groups["Surgeon"]["items"][0]["title"] == "Knee replacement"
    assert groups["Attending"]["items"][0]["title"] == "City Hospital — Pneumonia"


def test_related_covers_every_role_typed_fk(client, db_session):
    """All nine FKs must be reachable. Wave 1 found the report had missed two."""
    u = _admin(db_session)
    doc = _doctor(db_session, u)

    db_session.add(Medication(created_by=u.id, name="Med", prescribing_doctor_id=doc.id))
    db_session.add(Ailment(created_by=u.id, condition="Asthma", treating_doctor_id=doc.id))
    db_session.add(Surgery(created_by=u.id, procedure="Proc", surgeon_id=doc.id))
    db_session.add(Hospitalization(created_by=u.id, facility="Fac", attending_physician_id=doc.id))
    db_session.add(VisionHistory(created_by=u.id, rx_od="-1.00", provider_id=doc.id))
    db_session.add(DentalHistory(created_by=u.id, procedure="Cleaning", provider_id=doc.id))
    db_session.add(VisitLog(created_by=u.id, reason="Checkup", doctor_id=doc.id))
    db_session.add(Appointment(created_by=u.id, reason="Follow-up", status="upcoming",
                               appointment_datetime=datetime(2026, 9, 1, tzinfo=timezone.utc),
                               doctor_id=doc.id))
    db_session.add(Profile(created_by=u.id, full_name="Patient", main_doctor_id=doc.id))
    db_session.flush()

    _login(client)
    groups = client.get(f"/api/doctors/{doc.id}/related").json()
    roles = [g["role"] for g in groups]

    assert len(roles) == 9, f"expected all nine FK roles, got {roles}"
    assert roles[0] == "Primary Care", "the singleton fact belongs at the top"
    assert {"Prescriber", "Treating", "Surgeon", "Attending", "Vision Provider",
            "Dental Provider", "Seen At Visit", "Appointment"} <= set(roles)


def test_unrelated_doctor_returns_nothing(client, db_session):
    u = _admin(db_session)
    doc = _doctor(db_session, u)
    other = _doctor(db_session, u, name="Dr. Other")
    db_session.add(Medication(created_by=u.id, name="Metformin", prescribing_doctor_id=other.id))
    db_session.flush()

    _login(client)
    assert client.get(f"/api/doctors/{doc.id}/related").json() == []


def test_free_text_twin_is_not_counted(client, db_session):
    """Only linked records count.

    A free-text name is unresolved by definition — counting it would make the
    totals unverifiable, and the user could not tell which rows were real links.
    """
    u = _admin(db_session)
    doc = _doctor(db_session, u)
    db_session.add(Medication(created_by=u.id, name="Aspirin", prescribing_doctor="Dr. Nadar"))
    db_session.flush()

    _login(client)
    assert client.get(f"/api/doctors/{doc.id}/related").json() == []


def test_items_are_newest_first_with_undated_last(client, db_session):
    u = _admin(db_session)
    doc = _doctor(db_session, u)
    db_session.add(Medication(created_by=u.id, name="Older", prescribing_doctor_id=doc.id,
                              start_date=date(2020, 1, 1)))
    db_session.add(Medication(created_by=u.id, name="Newer", prescribing_doctor_id=doc.id,
                              start_date=date(2025, 1, 1)))
    db_session.add(Medication(created_by=u.id, name="Undated", prescribing_doctor_id=doc.id))
    db_session.flush()

    _login(client)
    items = client.get(f"/api/doctors/{doc.id}/related").json()[0]["items"]
    assert [i["title"] for i in items] == ["Newer", "Older", "Undated"]


def test_related_404_for_unknown_doctor(client, db_session):
    _admin(db_session)
    _login(client)
    assert client.get(f"/api/doctors/{uuid.uuid4()}/related").status_code == 404


def test_related_requires_authentication(client, db_session):
    u = _admin(db_session)
    doc = _doctor(db_session, u)
    db_session.flush()
    assert client.get(f"/api/doctors/{doc.id}/related").status_code == 401


def test_related_route_does_not_shadow_get_by_id(client, db_session):
    """The generated /{record_id} route must still work."""
    u = _admin(db_session)
    doc = _doctor(db_session, u)
    db_session.flush()
    _login(client)
    r = client.get(f"/api/doctors/{doc.id}")
    assert r.status_code == 200
    assert r.json()["name"] == "Dr. Nadar"
