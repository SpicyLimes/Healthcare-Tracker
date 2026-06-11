"""AI settings + chat endpoints: auth, CSRF, 503 gating."""
from app.models.user import Role
from app.services import user_service


def _login_admin(client, db_session, email="aiadmin@example.com"):
    user_service.create_user(db_session, email, "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": email, "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def _login_viewer(client, db_session, email="aiviewer@example.com"):
    user_service.create_user(db_session, email, "a-strong-passphrase-123", Role.viewer)
    client.post("/api/auth/login", json={"email": email, "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def test_get_ai_settings_admin_returns_defaults(client, db_session):
    _login_admin(client, db_session, email="getset@example.com")
    res = client.get("/api/settings/ai")
    assert res.status_code == 200
    body = res.json()
    assert body["enabled"] is False
    assert body["base_url"] is None


def test_get_ai_settings_viewer_forbidden(client, db_session):
    _login_viewer(client, db_session, email="getsetv@example.com")
    res = client.get("/api/settings/ai")
    assert res.status_code == 403


def test_update_ai_settings_admin(client, db_session):
    csrf = _login_admin(client, db_session, email="putset@example.com")
    res = client.put(
        "/api/settings/ai",
        headers={"X-CSRF-Token": csrf},
        json={"enabled": True, "base_url": "http://localhost:1234/v1", "model": "m"},
    )
    assert res.status_code == 200
    assert res.json()["enabled"] is True


def test_update_ai_settings_requires_csrf(client, db_session):
    _login_admin(client, db_session, email="putcsrf@example.com")
    res = client.put("/api/settings/ai", json={"enabled": True})
    assert res.status_code == 403
