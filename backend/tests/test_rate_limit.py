"""Tests for login endpoint rate limiting (10 req/min per IP)."""
import pytest


def test_login_rate_limit_allows_ten_requests(client):
    """10 login attempts within a minute all get 401 (wrong creds), not 429."""
    for i in range(10):
        r = client.post(
            "/api/auth/login",
            json={"email": "noone@example.com", "password": "wrongpassword"},
        )
        assert r.status_code == 401, f"Request {i+1} got unexpected status {r.status_code}"


def test_login_rate_limit_blocks_eleventh_request(client):
    """11th login attempt within a minute returns 429."""
    for _ in range(10):
        client.post(
            "/api/auth/login",
            json={"email": "noone@example.com", "password": "wrongpassword"},
        )
    r = client.post(
        "/api/auth/login",
        json={"email": "noone@example.com", "password": "wrongpassword"},
    )
    assert r.status_code == 429, f"Expected 429 on 11th request, got {r.status_code}"


def test_login_rate_limit_does_not_affect_other_endpoints(client):
    """Rate limit on login does not bleed into other endpoints."""
    for _ in range(11):
        client.post(
            "/api/auth/login",
            json={"email": "noone@example.com", "password": "wrongpassword"},
        )
    r = client.get("/api/health")
    assert r.status_code == 200


def test_real_ip_uses_x_real_ip():
    """nginx sets X-Real-IP to the real peer; the limiter keys off it."""
    from unittest.mock import MagicMock
    from app.limiter import _get_real_ip
    req = MagicMock()
    req.headers = {"X-Real-IP": "5.6.7.8"}
    req.client = MagicMock()
    req.client.host = "10.0.0.1"
    assert _get_real_ip(req) == "5.6.7.8"


def test_real_ip_ignores_spoofable_cf_and_xff_headers():
    """CF-Connecting-IP / X-Forwarded-For are client-supplied on the
    LAN/Tailscale paths and must NOT influence the rate-limit key."""
    from unittest.mock import MagicMock
    from app.limiter import _get_real_ip
    req = MagicMock()
    req.headers = {
        "CF-Connecting-IP": "1.2.3.4",
        "X-Forwarded-For": "9.9.9.9, 10.0.0.1",
    }
    req.client = MagicMock()
    req.client.host = "10.0.0.2"
    # No X-Real-IP -> fall back to the real peer, not the spoofable headers.
    assert _get_real_ip(req) == "10.0.0.2"


def test_real_ip_falls_back_to_client_host():
    from unittest.mock import MagicMock
    from app.limiter import _get_real_ip
    req = MagicMock()
    req.headers = {}
    req.client = MagicMock()
    req.client.host = "10.0.0.2"
    assert _get_real_ip(req) == "10.0.0.2"


def test_password_change_rate_limited(client, db_session):
    from app.models.user import Role
    from app.services import user_service
    user_service.create_user(db_session, "rl_pw@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "rl_pw@example.com", "password": "a-strong-passphrase-123"})
    csrf = client.cookies.get("csrf_token")
    for _ in range(10):
        client.put("/api/auth/password", headers={"X-CSRF-Token": csrf},
                   json={"current_password": "wrong", "new_password": "new-strong-passphrase-456"})
    r = client.put("/api/auth/password", headers={"X-CSRF-Token": csrf},
                   json={"current_password": "wrong", "new_password": "new-strong-passphrase-456"})
    assert r.status_code == 429


def test_refresh_rate_limited(client, db_session):
    from app.models.user import Role
    from app.services import user_service
    user_service.create_user(db_session, "rl_ref@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "rl_ref@example.com", "password": "a-strong-passphrase-123"})
    for _ in range(10):
        csrf = client.cookies.get("csrf_token")
        client.post("/api/auth/refresh", headers={"X-CSRF-Token": csrf})
    csrf = client.cookies.get("csrf_token")
    r = client.post("/api/auth/refresh", headers={"X-CSRF-Token": csrf})
    assert r.status_code == 429
