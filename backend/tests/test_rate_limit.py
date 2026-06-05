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
