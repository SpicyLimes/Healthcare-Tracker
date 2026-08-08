# backend/tests/test_calendar.py
import uuid
from datetime import date, datetime, timezone

from app.models.doctor import Doctor
from app.models.extended_records import Appointment, Hospitalization, Surgery, Vaccination, VisitLog
from app.models.medication import Medication
from app.models.user import Role
from app.routers.calendar import COLORS
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
    assert e["color"] == COLORS["appointment"]
    assert e["end_date"] is None
    assert e["doctor_name"] is None
    assert e["time"] == "10:00"


def test_calendar_appointment_with_doctor(client, db_session):
    u = _make_admin(db_session)
    doc = Doctor(created_by=u.id, name="Dr. Smith", specialty="General")
    db_session.add(doc)
    db_session.flush()
    appt = Appointment(
        created_by=u.id,
        appointment_datetime=datetime(2026, 8, 1, 9, 30, tzinfo=timezone.utc),
        reason="Follow-up",
        status="upcoming",
        doctor_id=doc.id,
    )
    db_session.add(appt)
    db_session.flush()
    _login(client)
    r = client.get("/api/calendar/events")
    assert r.status_code == 200
    events = r.json()
    assert len(events) == 1
    e = events[0]
    assert e["doctor_name"] == "Dr. Smith"
    assert e["time"] == "09:30"


def test_calendar_appointment_with_doctor_other(client, db_session):
    u = _make_admin(db_session)
    appt = Appointment(
        created_by=u.id,
        appointment_datetime=datetime(2026, 8, 5, 14, 0, tzinfo=timezone.utc),
        reason="Checkup",
        status="upcoming",
        doctor_other="Dr. Jones",
    )
    db_session.add(appt)
    db_session.flush()
    _login(client)
    r = client.get("/api/calendar/events")
    assert r.status_code == 200
    e = r.json()[0]
    assert e["doctor_name"] == "Dr. Jones"


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
    assert events[0]["color"] == COLORS["visit_log"]


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
    assert events[0]["color"] == COLORS["vaccination"]


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
    assert events[0]["color"] == COLORS["surgery"]


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
    assert events[0]["color"] == COLORS["hospitalization"]
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
    assert events[0]["color"] == COLORS["medication"]
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


def test_calendar_includes_other_user_records(client, db_session):
    # All authenticated users see all records — not filtered by creator
    _make_admin(db_session)
    other = user_service.create_user(db_session, "other@example.com", "a-strong-passphrase-123", Role.viewer)
    db_session.flush()
    v = VisitLog(created_by=other.id, visit_date=date(2026, 1, 1), reason="Other user visit")
    db_session.add(v)
    db_session.flush()
    _login(client)
    r = client.get("/api/calendar/events")
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["title"] == "Other user visit"


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


def test_calendar_completed_appointment_visit_log_appears_once(client, db_session):
    """When an appointment is completed its auto-created VisitLog must appear exactly once
    (as an appointment event, not also as a separate visit_log event)."""
    u = _make_admin(db_session)
    _login(client)
    csrf = client.cookies.get("csrf_token")
    h = {"X-CSRF-Token": csrf}

    appt = client.post(
        "/api/appointments",
        headers=h,
        json={"appointment_datetime": "2026-08-10T09:00:00", "status": "upcoming", "reason": "Dedup test"},
    ).json()
    client.put(f"/api/appointments/{appt['id']}", headers=h, json={"status": "completed"})

    r = client.get("/api/calendar/events")
    assert r.status_code == 200
    events = r.json()

    appt_events = [e for e in events if e["type"] == "appointment"]
    vl_events = [e for e in events if e["type"] == "visit_log"]

    assert len(appt_events) == 1, "appointment must appear once"
    # The auto-created visit_log must NOT appear as a separate calendar entry
    assert len(vl_events) == 0, "auto-created visit_log must be excluded from calendar visit_log events"


def test_visit_log_follow_up_date_appears_on_calendar(client, db_session):
    """A follow-up date typed on a visit log must reach the calendar.

    The field was captured in the model, schema, router, form and detail view —
    and read by nothing. Typing "recheck A1c" with a date felt like scheduling
    it, but produced no calendar entry and no appointment.
    """
    _make_admin(db_session)
    _login(client)
    h = {"X-CSRF-Token": client.cookies.get("csrf_token")}
    client.post("/api/visit-logs", headers=h, json={
        "visit_date": "2026-05-01", "reason": "A1c review", "follow_up_date": "2026-09-15",
    })

    events = client.get("/api/calendar/events").json()
    follow_ups = [e for e in events if e["type"] == "follow_up"]
    assert len(follow_ups) == 1, f"expected one follow-up event, got {follow_ups}"
    assert follow_ups[0]["date"] == "2026-09-15"
    assert "A1c review" in follow_ups[0]["title"]


def test_follow_up_is_projected_not_persisted(client, db_session):
    """The projection must not create an appointment or a second visit log."""
    _make_admin(db_session)
    _login(client)
    h = {"X-CSRF-Token": client.cookies.get("csrf_token")}
    client.post("/api/visit-logs", headers=h, json={
        "visit_date": "2026-05-01", "reason": "Checkup", "follow_up_date": "2026-09-15",
    })
    assert client.get("/api/appointments").json() == []
    assert len(client.get("/api/visit-logs").json()) == 1


def test_visit_log_without_follow_up_adds_no_event(client, db_session):
    _make_admin(db_session)
    _login(client)
    client.post("/api/visit-logs", headers={"X-CSRF-Token": client.cookies.get("csrf_token")},
                json={"visit_date": "2026-05-01", "reason": "Checkup"})
    events = client.get("/api/calendar/events").json()
    assert [e for e in events if e["type"] == "follow_up"] == []


def test_calendar_chip_colors_meet_wcag_aa_on_white_text():
    """Month-grid chips render white text at 10px; every type must clear 4.5:1."""
    from app.routers.calendar import COLORS

    def _lin(c: float) -> float:
        c /= 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4

    def _lum(hex_color: str) -> float:
        h = hex_color.lstrip("#")
        r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
        return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b)

    failures = []
    for name, hex_color in COLORS.items():
        contrast = (1.0 + 0.05) / (_lum(hex_color) + 0.05)
        if contrast < 4.5:
            failures.append(f"{name} ({hex_color}) = {contrast:.2f}:1")
    assert not failures, "chip colors below WCAG AA:\n  " + "\n  ".join(failures)
