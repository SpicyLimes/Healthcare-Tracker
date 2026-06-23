from app.models.user import Role
from app.services import user_service


def _admin(client, db):
    user_service.create_user(db, "admin@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "admin@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def _visit(**kw):
    base = {"visit_date": "2026-06-17", "reason": "Checkup"}
    base.update(kw)
    return base


def test_create_visit_with_bp_creates_linked_vitals(client, db_session):
    csrf = _admin(client, db_session)
    h = {"X-CSRF-Token": csrf}
    res = client.post("/api/visit-logs", headers=h, json=_visit(bp_systolic=120, bp_diastolic=80, pulse_bpm=72))
    assert res.status_code == 201, res.text
    assert res.json()["linked_vitals_id"] is not None
    vitals = client.get("/api/vitals").json()
    assert len(vitals) == 1
    assert vitals[0]["bp_systolic"] == 120
    assert vitals[0]["visit_log_id"] == res.json()["id"]


def test_create_visit_without_bp_creates_no_vitals(client, db_session):
    csrf = _admin(client, db_session)
    res = client.post("/api/visit-logs", headers={"X-CSRF-Token": csrf}, json=_visit())
    assert res.status_code == 201
    assert res.json()["linked_vitals_id"] is None
    assert client.get("/api/vitals").json() == []


def test_update_visit_bp_updates_same_vitals_no_duplicate(client, db_session):
    csrf = _admin(client, db_session); h = {"X-CSRF-Token": csrf}
    vid = client.post("/api/visit-logs", headers=h, json=_visit(bp_systolic=120, bp_diastolic=80)).json()["id"]
    client.put(f"/api/visit-logs/{vid}", headers=h, json={"bp_systolic": 130, "bp_diastolic": 85})
    vitals = client.get("/api/vitals").json()
    assert len(vitals) == 1
    assert vitals[0]["bp_systolic"] == 130


def test_update_adds_bp_to_previously_unlinked_visit(client, db_session):
    csrf = _admin(client, db_session); h = {"X-CSRF-Token": csrf}
    vid = client.post("/api/visit-logs", headers=h, json=_visit()).json()["id"]
    assert client.get("/api/vitals").json() == []
    res = client.put(f"/api/visit-logs/{vid}", headers=h, json={"bp_systolic": 118, "pulse_bpm": 70})
    assert res.json()["linked_vitals_id"] is not None
    assert len(client.get("/api/vitals").json()) == 1


def test_clearing_bp_and_pulse_keeps_entry_nulls_fields(client, db_session):
    csrf = _admin(client, db_session); h = {"X-CSRF-Token": csrf}
    vid = client.post("/api/visit-logs", headers=h, json=_visit(bp_systolic=120, bp_diastolic=80, pulse_bpm=72)).json()["id"]
    client.put(f"/api/visit-logs/{vid}", headers=h, json={"bp_systolic": None, "bp_diastolic": None, "pulse_bpm": None})
    vitals = client.get("/api/vitals").json()
    assert len(vitals) == 1
    assert vitals[0]["bp_systolic"] is None and vitals[0]["pulse_bpm"] is None


def test_delete_visit_keeps_vitals_unlinked(client, db_session):
    csrf = _admin(client, db_session); h = {"X-CSRF-Token": csrf}
    vid = client.post("/api/visit-logs", headers=h, json=_visit(bp_systolic=120, bp_diastolic=80)).json()["id"]
    client.delete(f"/api/visit-logs/{vid}", headers=h)
    vitals = client.get("/api/vitals").json()
    assert len(vitals) == 1
    assert vitals[0]["visit_log_id"] is None


def test_update_non_vitals_field_leaves_linked_vitals_unchanged(client, db_session):
    csrf = _admin(client, db_session); h = {"X-CSRF-Token": csrf}
    vid = client.post("/api/visit-logs", headers=h, json=_visit(bp_systolic=120, bp_diastolic=80, pulse_bpm=72)).json()["id"]
    # Update ONLY a non-vitals field; BP/Pulse keys are absent from the body
    client.put(f"/api/visit-logs/{vid}", headers=h, json={"reason": "Updated reason"})
    vitals = client.get("/api/vitals").json()
    assert len(vitals) == 1
    assert vitals[0]["bp_systolic"] == 120
    assert vitals[0]["bp_diastolic"] == 80
    assert vitals[0]["pulse_bpm"] == 72


def test_measured_at_uses_user_timezone_not_utc(client, db_session):
    # Admin defaults to America/Chicago. A visit at 14:30 local must store 19:30/20:30Z
    # (CDT is UTC-5 in May), NOT 14:30Z — and must stay on the same calendar day.
    csrf = _admin(client, db_session); h = {"X-CSRF-Token": csrf}
    client.post("/api/visit-logs", headers=h,
                json=_visit(visit_date="2026-05-19", visit_time="14:30", bp_systolic=120, bp_diastolic=80))
    vitals = client.get("/api/vitals").json()
    assert len(vitals) == 1
    measured = vitals[0]["measured_at"]
    # 14:30 America/Chicago in May (CDT, UTC-5) -> 19:30Z, still 2026-05-19
    assert measured.startswith("2026-05-19T19:30")


def test_midnight_date_only_visit_does_not_roll_to_previous_day(client, db_session):
    # The reported bug: a date-only visit (midnight local) was rendering as the
    # previous day. Midnight Central -> 05:00/06:00Z, which is still the SAME date.
    csrf = _admin(client, db_session); h = {"X-CSRF-Token": csrf}
    client.post("/api/visit-logs", headers=h,
                json=_visit(visit_date="2026-05-19", bp_systolic=118, pulse_bpm=70))
    vitals = client.get("/api/vitals").json()
    assert vitals[0]["measured_at"].startswith("2026-05-19")


def test_editing_only_visit_time_resyncs_linked_vitals_measured_at(client, db_session):
    # Bug B: create with BP but no time (midnight), then add the time in a later edit
    # that touches NO BP/Pulse keys. The linked vitals timestamp must follow the new time.
    csrf = _admin(client, db_session); h = {"X-CSRF-Token": csrf}
    vid = client.post("/api/visit-logs", headers=h,
                      json=_visit(visit_date="2026-05-19", bp_systolic=120, bp_diastolic=80)).json()["id"]
    before = client.get("/api/vitals").json()[0]["measured_at"]
    assert before.startswith("2026-05-19T05:00") or before.startswith("2026-05-19T06:00")  # midnight CDT->UTC
    # Edit ONLY the time — no BP/Pulse keys in the body
    client.put(f"/api/visit-logs/{vid}", headers=h, json={"visit_time": "14:30"})
    after = client.get("/api/vitals").json()
    assert len(after) == 1  # no duplicate row
    assert after[0]["measured_at"].startswith("2026-05-19T19:30")  # re-stamped to 14:30 CDT
    assert after[0]["bp_systolic"] == 120  # BP untouched


def test_create_visit_with_all_vitals_syncs_all_fields(client, db_session):
    csrf = _admin(client, db_session)
    h = {"X-CSRF-Token": csrf}
    res = client.post("/api/visit-logs", headers=h, json=_visit(
        bp_systolic=120, bp_diastolic=80, pulse_bpm=72,
        height_in=64.0, weight_lb=150.0,
        temperature_f=98.6, respiratory_rate=16,
        spo2=98, blood_glucose=95,
    ))
    assert res.status_code == 201, res.text
    vitals = client.get("/api/vitals").json()
    assert len(vitals) == 1
    v = vitals[0]
    assert v["height_in"] == 64.0
    assert v["weight_lb"] == 150.0
    assert v["temperature_f"] == 98.6
    assert v["respiratory_rate"] == 16
    assert v["spo2"] == 98
    assert v["blood_glucose"] == 95


def test_update_visit_height_updates_linked_vitals(client, db_session):
    csrf = _admin(client, db_session)
    h = {"X-CSRF-Token": csrf}
    vid = client.post("/api/visit-logs", headers=h, json=_visit(
        bp_systolic=120, bp_diastolic=80, height_in=64.0,
    )).json()["id"]
    client.put(f"/api/visit-logs/{vid}", headers=h, json={"height_in": 65.0})
    vitals = client.get("/api/vitals").json()
    assert len(vitals) == 1
    assert vitals[0]["height_in"] == 65.0


def test_visit_log_list_injects_all_nine_vitals_fields(client, db_session):
    """GET /api/visit-logs must return all 9 vitals fields on the visit log response."""
    csrf = _admin(client, db_session)
    h = {"X-CSRF-Token": csrf}
    client.post("/api/visit-logs", headers=h, json=_visit(
        bp_systolic=120, bp_diastolic=80, pulse_bpm=72,
        height_in=70.0, weight_lb=175.0, temperature_f=98.6,
        respiratory_rate=16, spo2=98, blood_glucose=90,
    ))
    rows = client.get("/api/visit-logs").json()
    assert len(rows) == 1
    vl = rows[0]
    assert vl["bp_systolic"] == 120
    assert vl["bp_diastolic"] == 80
    assert vl["pulse_bpm"] == 72
    assert vl["height_in"] == 70.0
    assert vl["weight_lb"] == 175.0
    assert vl["temperature_f"] == 98.6
    assert vl["respiratory_rate"] == 16
    assert vl["spo2"] == 98
    assert vl["blood_glucose"] == 90


def test_vitals_circular_fk_both_sides_consistent(client, db_session):
    """After creating a visit log with vitals, both FK pointers must agree:
    VisitLog.linked_vitals_id == Vitals.id AND Vitals.visit_log_id == VisitLog.id."""
    csrf = _admin(client, db_session)
    h = {"X-CSRF-Token": csrf}
    vl = client.post("/api/visit-logs", headers=h, json=_visit(bp_systolic=130, bp_diastolic=85)).json()
    vitals = client.get("/api/vitals").json()
    assert len(vitals) == 1
    v = vitals[0]
    # VisitLog.linked_vitals_id → Vitals.id
    assert vl["linked_vitals_id"] == v["id"]
    # Vitals.visit_log_id → VisitLog.id
    assert v["visit_log_id"] == vl["id"]
