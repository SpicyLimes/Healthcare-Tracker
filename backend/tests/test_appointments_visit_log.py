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


def test_completing_appointment_creates_visit_log(client, db_session):
    """Setting status to 'completed' must auto-create a Visit Log."""
    csrf = _admin(client, db_session)
    h = {"X-CSRF-Token": csrf}
    appt_id = client.post("/api/appointments", headers=h, json=_appt()).json()["id"]

    res = client.put(f"/api/appointments/{appt_id}", headers=h, json={"status": "completed"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "completed"
    assert body["visit_log_id"] is not None

    # The auto-created visit log must exist and be pre-filled
    vl = client.get(f"/api/visit-logs/{body['visit_log_id']}").json()
    assert vl["visit_date"] == "2026-07-15"
    assert vl["reason"] == "Annual checkup"


def test_completing_appointment_twice_creates_only_one_visit_log(client, db_session):
    """Re-completing an already-completed appointment must NOT create a second Visit Log."""
    csrf = _admin(client, db_session)
    h = {"X-CSRF-Token": csrf}
    appt_id = client.post("/api/appointments", headers=h, json=_appt()).json()["id"]
    client.put(f"/api/appointments/{appt_id}", headers=h, json={"status": "completed"})
    client.put(f"/api/appointments/{appt_id}", headers=h, json={"status": "completed"})

    logs = client.get("/api/visit-logs").json()
    assert len(logs) == 1


def test_cancelling_appointment_does_not_create_visit_log(client, db_session):
    """Cancelling must NOT create a Visit Log."""
    csrf = _admin(client, db_session)
    h = {"X-CSRF-Token": csrf}
    appt_id = client.post("/api/appointments", headers=h, json=_appt()).json()["id"]
    res = client.put(f"/api/appointments/{appt_id}", headers=h, json={"status": "cancelled"})
    assert res.status_code == 200
    assert res.json()["visit_log_id"] is None
    assert client.get("/api/visit-logs").json() == []


def test_rescheduling_appointment_does_not_create_visit_log(client, db_session):
    """Rescheduling must NOT create a Visit Log."""
    csrf = _admin(client, db_session)
    h = {"X-CSRF-Token": csrf}
    appt_id = client.post("/api/appointments", headers=h, json=_appt()).json()["id"]
    res = client.put(f"/api/appointments/{appt_id}", headers=h, json={"status": "rescheduled"})
    assert res.status_code == 200
    assert res.json()["visit_log_id"] is None
    assert client.get("/api/visit-logs").json() == []


def test_completing_evening_appointment_uses_local_wall_clock(client, db_session):
    """A late-UTC appointment must land on the user's local date/time, not the UTC one."""
    csrf = _admin(client, db_session)
    h = {"X-CSRF-Token": csrf}
    client.put("/api/auth/timezone", headers=h, json={"timezone": "America/Chicago"})
    # 01:30 UTC on the 16th == 20:30 CDT on the 15th
    appt_id = client.post(
        "/api/appointments", headers=h,
        json=_appt(appointment_datetime="2026-07-16T01:30:00Z"),
    ).json()["id"]
    res = client.put(f"/api/appointments/{appt_id}", headers=h, json={"status": "completed"})
    vl = client.get(f"/api/visit-logs/{res.json()['visit_log_id']}").json()
    assert vl["visit_date"] == "2026-07-15"
    assert vl["visit_time"] == "20:30:00"


def test_completing_appointment_utc_user_keeps_wall_clock(client, db_session):
    """With a UTC user, the stored value passes through unshifted."""
    csrf = _admin(client, db_session)
    h = {"X-CSRF-Token": csrf}
    client.put("/api/auth/timezone", headers=h, json={"timezone": "UTC"})
    appt_id = client.post(
        "/api/appointments", headers=h,
        json=_appt(appointment_datetime="2026-07-15T12:00:00Z"),
    ).json()["id"]
    res = client.put(f"/api/appointments/{appt_id}", headers=h, json={"status": "completed"})
    vl = client.get(f"/api/visit-logs/{res.json()['visit_log_id']}").json()
    assert vl["visit_date"] == "2026-07-15"
    assert vl["visit_time"] == "12:00:00"


def test_completing_appointment_with_doctor_prefills_visit_log_doctor(client, db_session):
    """visit_log.doctor_id must be pre-filled from the appointment's doctor_id."""
    from app.models.doctor import Doctor
    import uuid as _uuid
    csrf = _admin(client, db_session)
    h = {"X-CSRF-Token": csrf}
    # Create a doctor directly via DB (no doctor API needed for this test)
    doc = Doctor(id=_uuid.uuid4(), name="Dr. Smith")
    db_session.add(doc)
    db_session.commit()

    appt_id = client.post(
        "/api/appointments", headers=h,
        json=_appt(doctor_id=str(doc.id))
    ).json()["id"]
    res = client.put(f"/api/appointments/{appt_id}", headers=h, json={"status": "completed"})
    vl_id = res.json()["visit_log_id"]
    vl = client.get(f"/api/visit-logs/{vl_id}").json()
    assert vl["doctor_id"] == str(doc.id)
