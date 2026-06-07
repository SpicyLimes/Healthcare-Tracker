# backend/tests/test_calendar.py
import uuid
from datetime import date, datetime, timezone

from app.models.extended_records import Appointment, Hospitalization, Surgery, Vaccination, VisitLog
from app.models.medication import Medication
from app.models.user import Role
from app.services import user_service


def _make_admin(db):
    u = user_service.create_user(db, "cal@example.com", "a-strong-passphrase-123", Role.admin)
    db.flush()
    return u


def _login(client):
    client.post("/api/auth/login", json={"email": "cal@example.com", "password": "a-strong-passphrase-123"})


def test_calendar_empty(client, db_session):
    _make_admin(db_session)
    _login(client)
    r = client.get("/api/calendar/events")
    assert r.status_code == 200
    assert r.json() == []


def test_calendar_appointment(client, db_session):
    u = _make_admin(db_session)
    appt = Appointment(
        created_by=u.id,
        appointment_datetime=datetime(2026, 7, 15, 10, 0, tzinfo=timezone.utc),
        reason="Annual physical",
        status="upcoming",
    )
    db_session.add(appt)
    db_session.flush()
    _login(client)
    r = client.get("/api/calendar/events")
    assert r.status_code == 200
    events = r.json()
    assert len(events) == 1
    e = events[0]
    assert e["type"] == "appointment"
    assert e["title"] == "Annual physical"
    assert e["date"] == "2026-07-15"
    assert e["color"] == "#3b82f6"
    assert e["end_date"] is None


def test_calendar_visit_log(client, db_session):
    u = _make_admin(db_session)
    v = VisitLog(created_by=u.id, visit_date=date(2026, 6, 1), reason="Checkup")
    db_session.add(v)
    db_session.flush()
    _login(client)
    r = client.get("/api/calendar/events")
    assert r.status_code == 200
    events = r.json()
    assert len(events) == 1
    assert events[0]["type"] == "visit_log"
    assert events[0]["title"] == "Checkup"
    assert events[0]["color"] == "#8b5cf6"


def test_calendar_vaccination(client, db_session):
    u = _make_admin(db_session)
    v = Vaccination(created_by=u.id, vaccine="Flu Shot", administered_date=date(2026, 10, 1))
    db_session.add(v)
    db_session.flush()
    _login(client)
    r = client.get("/api/calendar/events")
    assert r.status_code == 200
    events = r.json()
    assert events[0]["type"] == "vaccination"
    assert events[0]["title"] == "Flu Shot"
    assert events[0]["color"] == "#10b981"


def test_calendar_surgery(client, db_session):
    u = _make_admin(db_session)
    s = Surgery(created_by=u.id, procedure="Knee replacement", surgery_date=date(2025, 3, 10))
    db_session.add(s)
    db_session.flush()
    _login(client)
    r = client.get("/api/calendar/events")
    assert r.status_code == 200
    events = r.json()
    assert events[0]["type"] == "surgery"
    assert events[0]["title"] == "Knee replacement"
    assert events[0]["color"] == "#ef4444"


def test_calendar_hospitalization(client, db_session):
    u = _make_admin(db_session)
    h = Hospitalization(
        created_by=u.id,
        facility="City Hospital",
        reason="Pneumonia",
        admission_date=date(2025, 1, 5),
        discharge_date=date(2025, 1, 12),
    )
    db_session.add(h)
    db_session.flush()
    _login(client)
    r = client.get("/api/calendar/events")
    assert r.status_code == 200
    events = r.json()
    assert events[0]["type"] == "hospitalization"
    assert events[0]["title"] == "City Hospital — Pneumonia"
    assert events[0]["color"] == "#f97316"
    assert events[0]["end_date"] == "2025-01-12"


def test_calendar_medication(client, db_session):
    u = _make_admin(db_session)
    m = Medication(
        created_by=u.id,
        name="Metformin",
        dose="500mg",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 12, 31),
    )
    db_session.add(m)
    db_session.flush()
    _login(client)
    r = client.get("/api/calendar/events")
    assert r.status_code == 200
    events = r.json()
    assert events[0]["type"] == "medication"
    assert events[0]["title"] == "Metformin 500mg"
    assert events[0]["color"] == "#eab308"
    assert events[0]["end_date"] == "2024-12-31"


def test_calendar_null_date_excluded(client, db_session):
    u = _make_admin(db_session)
    v = VisitLog(created_by=u.id, visit_date=None, reason="No date")
    db_session.add(v)
    db_session.flush()
    _login(client)
    r = client.get("/api/calendar/events")
    assert r.status_code == 200
    assert r.json() == []


def test_calendar_other_user_excluded(client, db_session):
    u = _make_admin(db_session)
    other = user_service.create_user(db_session, "other@example.com", "a-strong-passphrase-123", Role.viewer)
    db_session.flush()
    v = VisitLog(created_by=other.id, visit_date=date(2026, 1, 1), reason="Other user visit")
    db_session.add(v)
    db_session.flush()
    _login(client)
    r = client.get("/api/calendar/events")
    assert r.status_code == 200
    assert r.json() == []


def test_calendar_invalid_date_range_excluded(client, db_session):
    u = _make_admin(db_session)
    m = Medication(
        created_by=u.id,
        name="BadMed",
        start_date=date(2026, 6, 10),
        end_date=date(2026, 6, 1),
    )
    db_session.add(m)
    db_session.flush()
    _login(client)
    r = client.get("/api/calendar/events")
    assert r.status_code == 200
    assert r.json() == []


def test_calendar_unauthenticated(client, db_session):
    r = client.get("/api/calendar/events")
    assert r.status_code == 401


def test_calendar_sorted_by_date(client, db_session):
    u = _make_admin(db_session)
    db_session.add(VisitLog(created_by=u.id, visit_date=date(2026, 9, 1), reason="Later"))
    db_session.add(VisitLog(created_by=u.id, visit_date=date(2026, 3, 1), reason="Earlier"))
    db_session.flush()
    _login(client)
    r = client.get("/api/calendar/events")
    assert r.status_code == 200
    events = r.json()
    assert events[0]["date"] < events[1]["date"]
