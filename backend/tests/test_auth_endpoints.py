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
