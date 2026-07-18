import pytest

from app.models.user import Role
from app.services import user_service


def _login(client, db_session, email="admin@example.com", password="a-strong-passphrase-123", role=Role.admin):
    user_service.create_user(db_session, email, password, role)
    return client.post("/api/auth/login", json={"email": email, "password": password})


def test_login_sets_cookies_and_returns_user(client, db_session):
    resp = _login(client, db_session)
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "admin@example.com"
    assert body["role"] == "admin"
    assert "access_token" in resp.cookies
    assert "refresh_token" in resp.cookies
    assert "csrf_token" in resp.cookies


def test_login_rejects_bad_password(client, db_session):
    user_service.create_user(db_session, "admin@example.com", "a-strong-passphrase-123", Role.admin)
    resp = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "wrong-passphrase-x"})
    assert resp.status_code == 401


def test_me_returns_current_user(client, db_session):
    _login(client, db_session)
    resp = client.get("/api/auth/me")
    assert resp.status_code == 200
    assert resp.json()["email"] == "admin@example.com"


def test_logout_clears_cookies(client, db_session):
    _login(client, db_session)
    csrf = client.cookies.get("csrf_token")
    resp = client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    assert resp.status_code == 204
    me = client.get("/api/auth/me")
    assert me.status_code == 401


def test_refresh_issues_new_access(client, db_session):
    _login(client, db_session)
    csrf = client.cookies.get("csrf_token")
    resp = client.post("/api/auth/refresh", headers={"X-CSRF-Token": csrf})
    assert resp.status_code == 200
    assert "access_token" in resp.cookies


def test_change_password_requires_correct_current(client, db_session):
    _login(client, db_session)
    csrf = client.cookies.get("csrf_token")
    bad = client.put("/api/auth/password", headers={"X-CSRF-Token": csrf},
                     json={"current_password": "wrong", "new_password": "new-strong-passphrase-456"})
    assert bad.status_code == 400
    good = client.put("/api/auth/password", headers={"X-CSRF-Token": csrf},
                      json={"current_password": "a-strong-passphrase-123", "new_password": "new-strong-passphrase-456"})
    assert good.status_code == 204


@pytest.mark.parametrize("method,path", [
    ("POST", "/api/auth/refresh"),
    ("POST", "/api/auth/logout"),
    ("PUT", "/api/auth/password"),
    ("PUT", "/api/auth/name"),
])
def test_csrf_missing_header_rejected(client, db_session, method, path):
    _login(client, db_session)
    resp = client.request(method, path, json={})
    assert resp.status_code == 403


def test_csrf_wrong_token_rejected(client, db_session):
    _login(client, db_session)
    resp = client.post("/api/auth/refresh", headers={"X-CSRF-Token": "wrong-value"})
    assert resp.status_code == 403


def test_refresh_without_cookie_is_unauthorized(client, db_session):
    # Establish a CSRF cookie via login, then DELETE the refresh cookie so rotation fails.
    _login(client, db_session)
    csrf = client.cookies.get("csrf_token")
    client.cookies.delete("refresh_token")
    resp = client.post("/api/auth/refresh", headers={"X-CSRF-Token": csrf})
    assert resp.status_code == 401


def test_refresh_with_invalid_token_is_unauthorized(client, db_session):
    _login(client, db_session)
    csrf = client.cookies.get("csrf_token")
    client.cookies.set("refresh_token", "not-a-real-refresh-token")
    resp = client.post("/api/auth/refresh", headers={"X-CSRF-Token": csrf})
    assert resp.status_code == 401


def test_user_can_set_own_name(client, db_session):
    _login(client, db_session)
    csrf = client.cookies.get("csrf_token")
    resp = client.put(
        "/api/auth/name",
        headers={"X-CSRF-Token": csrf},
        json={"full_name": "Devin Rauch"},
    )
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Devin Rauch"
    me = client.get("/api/auth/me")
    assert me.json()["full_name"] == "Devin Rauch"


def test_user_can_clear_own_name(client, db_session):
    _login(client, db_session)
    csrf = client.cookies.get("csrf_token")
    client.put("/api/auth/name", headers={"X-CSRF-Token": csrf}, json={"full_name": "Devin Rauch"})
    resp = client.put("/api/auth/name", headers={"X-CSRF-Token": csrf}, json={"full_name": None})
    assert resp.status_code == 200
    assert resp.json()["full_name"] is None


def test_set_name_requires_authentication(client, db_session):
    resp = client.put("/api/auth/name", json={"full_name": "Anyone"})
    assert resp.status_code == 401


def test_set_name_empty_string_clears_name(client, db_session):
    _login(client, db_session)
    csrf = client.cookies.get("csrf_token")
    client.put("/api/auth/name", headers={"X-CSRF-Token": csrf}, json={"full_name": "Devin Rauch"})
    resp = client.put("/api/auth/name", headers={"X-CSRF-Token": csrf}, json={"full_name": ""})
    assert resp.status_code == 200
    assert resp.json()["full_name"] is None


def test_user_can_set_own_timezone(client, db_session):
    _login(client, db_session)
    csrf = client.cookies.get("csrf_token")
    resp = client.put(
        "/api/auth/timezone",
        headers={"X-CSRF-Token": csrf},
        json={"timezone": "America/Los_Angeles"},
    )
    assert resp.status_code == 200
    assert resp.json()["timezone"] == "America/Los_Angeles"
    me = client.get("/api/auth/me")
    assert me.json()["timezone"] == "America/Los_Angeles"


def test_timezone_rejects_unknown_zone(client, db_session):
    _login(client, db_session)
    csrf = client.cookies.get("csrf_token")
    resp = client.put(
        "/api/auth/timezone",
        headers={"X-CSRF-Token": csrf},
        json={"timezone": "Mars/Olympus"},
    )
    assert resp.status_code == 422


def test_timezone_requires_authentication(client, db_session):
    resp = client.put("/api/auth/timezone", json={"timezone": "America/Los_Angeles"})
    assert resp.status_code == 401


def test_me_returns_timezone(client, db_session):
    _login(client, db_session)
    me = client.get("/api/auth/me")
    assert "timezone" in me.json()
    assert me.json()["timezone"] == "America/Chicago"


def test_change_password_revokes_other_sessions(client, db_session):
    from fastapi.testclient import TestClient
    from app.main import app

    user_service.create_user(db_session, "admin@example.com", "a-strong-passphrase-123", Role.admin)
    other = TestClient(app)  # a second device with its own cookie jar
    other.post("/api/auth/login", json={"email": "admin@example.com", "password": "a-strong-passphrase-123"})
    client.post("/api/auth/login", json={"email": "admin@example.com", "password": "a-strong-passphrase-123"})

    csrf = client.cookies.get("csrf_token")
    resp = client.put("/api/auth/password", headers={"X-CSRF-Token": csrf},
                      json={"current_password": "a-strong-passphrase-123",
                            "new_password": "new-strong-passphrase-456"})
    assert resp.status_code == 204
    assert "refresh_token" in resp.cookies  # requesting device got a fresh session

    # the requesting device keeps working with its re-issued session
    ok = client.post("/api/auth/refresh", headers={"X-CSRF-Token": client.cookies.get("csrf_token")})
    assert ok.status_code == 200

    # the other device's refresh token was revoked
    dead = other.post("/api/auth/refresh", headers={"X-CSRF-Token": other.cookies.get("csrf_token")})
    assert dead.status_code == 401


def test_old_refresh_token_dead_after_password_change(client, db_session):
    _login(client, db_session)
    old_refresh = client.cookies.get("refresh_token")
    csrf = client.cookies.get("csrf_token")
    resp = client.put("/api/auth/password", headers={"X-CSRF-Token": csrf},
                      json={"current_password": "a-strong-passphrase-123",
                            "new_password": "new-strong-passphrase-456"})
    assert resp.status_code == 204
    client.cookies.set("refresh_token", old_refresh)
    dead = client.post("/api/auth/refresh", headers={"X-CSRF-Token": client.cookies.get("csrf_token")})
    assert dead.status_code == 401


def test_admin_password_reset_revokes_target_sessions(client, db_session):
    from fastapi.testclient import TestClient
    from app.main import app

    _login(client, db_session)  # admin
    target = user_service.create_user(db_session, "viewer@example.com", "viewer-passphrase-123", Role.viewer)
    other = TestClient(app)  # target's logged-in device
    other.post("/api/auth/login", json={"email": "viewer@example.com", "password": "viewer-passphrase-123"})

    csrf = client.cookies.get("csrf_token")
    resp = client.put(f"/api/users/{target.id}/password", headers={"X-CSRF-Token": csrf},
                      json={"new_password": "reset-strong-passphrase-789"})
    assert resp.status_code == 204

    dead = other.post("/api/auth/refresh", headers={"X-CSRF-Token": other.cookies.get("csrf_token")})
    assert dead.status_code == 401


def test_login_prunes_stale_refresh_tokens(client, db_session):
    from datetime import datetime, timedelta, timezone
    from app.models.refresh_token import RefreshToken

    user = user_service.create_user(db_session, "admin@example.com", "a-strong-passphrase-123", Role.admin)
    now = datetime.now(timezone.utc)
    db_session.add_all([
        RefreshToken(user_id=user.id, token_hash="stale-hash", expires_at=now - timedelta(days=40)),
        # expired only yesterday: inside the 30-day grace window, must survive
        RefreshToken(user_id=user.id, token_hash="recent-hash", expires_at=now - timedelta(days=1)),
    ])
    db_session.flush()

    resp = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "a-strong-passphrase-123"})
    assert resp.status_code == 200

    remaining = {t.token_hash for t in db_session.query(RefreshToken).all()}
    assert "stale-hash" not in remaining
    assert "recent-hash" in remaining


def test_failed_login_is_audit_logged(client, db_session):
    from app.models.audit_log import AuditLog
    client.post("/api/auth/login", json={"email": "notauser@example.com", "password": "wrong"})
    entries = db_session.query(AuditLog).filter(
        AuditLog.detail.contains("notauser@example.com")
    ).all()
    assert len(entries) == 1
    assert "Failed login" in entries[0].detail
    from app.models.audit_log import AuditAction
    assert entries[0].action == AuditAction.login_failed
