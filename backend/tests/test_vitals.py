from datetime import datetime, timezone

from app.models.user import Role
from app.schemas.extended_records import VitalsResponse
from app.services import user_service


def _resp(**kw):
    base = dict(
        id="11111111-1111-1111-1111-111111111111",
        measured_at=datetime(2026, 6, 17, 14, 30, tzinfo=timezone.utc),
        bp_systolic=None, bp_diastolic=None, pulse_bpm=None,
        height_in=None, weight_lb=None, temperature_f=None,
        respiratory_rate=None, spo2=None, blood_glucose=None,
        notes=None, visit_log_id=None,
        created_at=datetime(2026, 6, 17, 14, 30, tzinfo=timezone.utc),
        updated_at=datetime(2026, 6, 17, 14, 30, tzinfo=timezone.utc),
    )
    base.update(kw)
    return VitalsResponse(**base)


def test_bmi_computed_when_height_and_weight_present():
    r = _resp(height_in=65, weight_lb=150)
    assert r.bmi == 25.0  # round(703*150/65**2, 1)


def test_bmi_null_when_missing_height_or_weight():
    assert _resp(weight_lb=150).bmi is None
    assert _resp(height_in=65).bmi is None
    assert _resp().bmi is None


def _admin(client, db):
    user_service.create_user(db, "admin@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "admin@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def test_create_and_list_vitals(client, db_session):
    csrf = _admin(client, db_session)
    payload = {"measured_at": "2026-06-17T14:30:00Z", "bp_systolic": 120, "bp_diastolic": 80, "pulse_bpm": 72}
    res = client.post("/api/vitals", headers={"X-CSRF-Token": csrf}, json=payload)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["bp_systolic"] == 120
    assert body["bmi"] is None

    res = client.get("/api/vitals")
    assert res.status_code == 200
    assert len(res.json()) == 1
