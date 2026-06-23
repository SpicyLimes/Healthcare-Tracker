from app.models.user import Role
from app.services import user_service


def _admin(client, db_session):
    user_service.create_user(db_session, "admin@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "admin@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def _appt(**kw):
    base = {
        "appointment_datetime": "2026-07-15T09:00:00Z",
        "reason": "Annual checkup",
        "status": "upcoming",
    }
    base.update(kw)
    return base


def test_appointment_response_includes_visit_log_id(client, db_session):
    """AppointmentResponse must expose visit_log_id (null for a new upcoming appointment)."""
    csrf = _admin(client, db_session)
    res = client.post("/api/appointments", headers={"X-CSRF-Token": csrf}, json=_appt())
    assert res.status_code == 201, res.text
    body = res.json()
    assert "visit_log_id" in body
    assert body["visit_log_id"] is None
