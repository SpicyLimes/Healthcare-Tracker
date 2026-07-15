# backend/tests/test_reminders_endpoints.py
"""Endpoint tests for the Daily Reminders API."""
from app.models.user import Role
from app.services import user_service


def _login_admin(client, db):
    user_service.create_user(db, "admin@reminders.example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "admin@reminders.example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def _login_viewer(client, db):
    user_service.create_user(db, "viewer@reminders.example.com", "a-strong-passphrase-123", Role.viewer)
    client.post("/api/auth/login", json={"email": "viewer@reminders.example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def test_get_returns_default_layout_when_none_saved(client, db_session):
    _login_admin(client, db_session)
    r = client.get("/api/reminders")
    assert r.status_code == 200, r.text
    assert r.json()["layout"]["title"] == "MY DAILY MEDICATIONS"
    assert len(r.json()["layout"]["sections"]) == 4


def test_put_then_get_roundtrips_the_layout(client, db_session):
    csrf = _login_admin(client, db_session)
    layout = {"title": "MY CUSTOM SHEET", "sections": [], "reminders": [], "avoid": [], "notes": "hi"}

    r = client.put("/api/reminders", headers={"X-CSRF-Token": csrf}, json={"layout": layout})
    assert r.status_code == 200, r.text
    assert r.json()["layout"]["title"] == "MY CUSTOM SHEET"

    r = client.get("/api/reminders")
    assert r.status_code == 200
    assert r.json()["layout"]["title"] == "MY CUSTOM SHEET"
    assert r.json()["layout"]["notes"] == "hi"


def test_put_twice_updates_in_place_and_does_not_accumulate_rows(client, db_session):
    from app.models.reminder import ReminderPage

    csrf = _login_admin(client, db_session)
    client.put("/api/reminders", headers={"X-CSRF-Token": csrf}, json={"layout": {"title": "ONE"}})
    client.put("/api/reminders", headers={"X-CSRF-Token": csrf}, json={"layout": {"title": "TWO"}})

    assert db_session.query(ReminderPage).count() == 1
    r = client.get("/api/reminders")
    assert r.json()["layout"]["title"] == "TWO"


def test_viewer_cannot_read(client, db_session):
    _login_viewer(client, db_session)
    r = client.get("/api/reminders")
    assert r.status_code == 403


def test_viewer_cannot_write(client, db_session):
    csrf = _login_viewer(client, db_session)
    r = client.put("/api/reminders", headers={"X-CSRF-Token": csrf}, json={"layout": {"title": "nope"}})
    assert r.status_code == 403


def test_anonymous_cannot_read(client, db_session):
    r = client.get("/api/reminders")
    assert r.status_code == 401


def test_put_without_csrf_is_rejected(client, db_session):
    _login_admin(client, db_session)
    r = client.put("/api/reminders", json={"layout": {"title": "nope"}})
    assert r.status_code == 403
