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


def test_real_ip_uses_cf_connecting_ip():
    from unittest.mock import MagicMock
    from app.limiter import _get_real_ip
    req = MagicMock()
    req.headers = {"CF-Connecting-IP": "1.2.3.4"}
    req.client = MagicMock()
    req.client.host = "10.0.0.1"
    assert _get_real_ip(req) == "1.2.3.4"


def test_real_ip_falls_back_to_x_forwarded_for():
    from unittest.mock import MagicMock
    from app.limiter import _get_real_ip
    req = MagicMock()
    req.headers = {"X-Forwarded-For": "5.6.7.8, 10.0.0.1"}
    req.client = MagicMock()
    req.client.host = "10.0.0.1"
    assert _get_real_ip(req) == "5.6.7.8"


def test_real_ip_falls_back_to_client_host():
    from unittest.mock import MagicMock
    from app.limiter import _get_real_ip
    req = MagicMock()
    req.headers = {}
    req.client = MagicMock()
    req.client.host = "10.0.0.2"
    assert _get_real_ip(req) == "10.0.0.2"
