# backend/tests/test_audit_log.py
"""Audit log: write on mutations, guest access writes entry, filters work."""
import pytest

from app.models.user import Role
from app.services import user_service


def _admin(client, db):
    user_service.create_user(db, "auditadmin@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "auditadmin@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def _viewer(client, db):
    user_service.create_user(db, "auditviewer@example.com", "a-strong-passphrase-123", Role.viewer)
    client.post("/api/auth/login", json={"email": "auditviewer@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def test_create_record_writes_audit_entry(client, db_session):
    csrf = _admin(client, db_session)
    client.post(
        "/api/vaccinations",
        headers={"X-CSRF-Token": csrf},
        json={"vaccine": "FluShot"},
    )
    r = client.get("/api/audit-log")
    assert r.status_code == 200
    entries = r.json()
    create_entries = [e for e in entries if e["action"] == "create"]
    assert any(e["section"] and "vaccination" in e["section"] for e in create_entries)


def test_delete_record_writes_audit_entry(client, db_session):
    csrf = _admin(client, db_session)
    vax = client.post(
        "/api/vaccinations",
        headers={"X-CSRF-Token": csrf},
        json={"vaccine": "FluShot"},
    ).json()
    client.delete(f"/api/vaccinations/{vax['id']}", headers={"X-CSRF-Token": csrf})
    entries = client.get("/api/audit-log").json()
    assert any(e["action"] == "delete" for e in entries)


def test_guest_access_writes_audit_entry(client, db_session):
    from datetime import datetime, timedelta, timezone
    csrf = _admin(client, db_session)
    token = client.post(
        "/api/share-links",
        headers={"X-CSRF-Token": csrf},
        json={
            "label": "AuditTest",
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "allowed_sections": [],
        },
    ).json()["token_url"].split("token=")[1]
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    client.get(f"/api/guest/vaccinations?token={token}")
    # Re-login to read audit log — use the existing user (already committed by guest handler)
    client.post("/api/auth/login", json={"email": "auditadmin@example.com", "password": "a-strong-passphrase-123"})
    entries = client.get("/api/audit-log").json()
    assert any(e["action"] == "share_link_access" and e["actor_type"] == "guest" for e in entries)


def test_audit_log_filter_by_action(client, db_session):
    csrf = _admin(client, db_session)
    client.post(
        "/api/vaccinations",
        headers={"X-CSRF-Token": csrf},
        json={"vaccine": "TestVax"},
    )
    r = client.get("/api/audit-log?action=create")
    assert r.status_code == 200
    assert all(e["action"] == "create" for e in r.json())


def test_audit_log_filter_by_actor_type(client, db_session):
    csrf = _admin(client, db_session)
    client.post(
        "/api/vaccinations",
        headers={"X-CSRF-Token": csrf},
        json={"vaccine": "TestVax"},
    )
    r = client.get("/api/audit-log?actor_type=user")
    assert r.status_code == 200
    assert all(e["actor_type"] == "user" for e in r.json())


def test_viewer_cannot_access_audit_log(client, db_session):
    _admin(client, db_session)
    _viewer(client, db_session)
    r = client.get("/api/audit-log")
    assert r.status_code in (401, 403)


def test_audit_log_failure_does_not_break_operation(client, db_session, monkeypatch):
    """Simulate audit service failure — the create should still succeed."""
    def _boom(*a, **kw):
        raise RuntimeError("simulated audit failure")

    monkeypatch.setattr("app.routers.records.log_event", _boom)
    csrf = _admin(client, db_session)
    r = client.post(
        "/api/vaccinations",
        headers={"X-CSRF-Token": csrf},
        json={"vaccine": "ShouldSucceed"},
    )
    assert r.status_code == 201
