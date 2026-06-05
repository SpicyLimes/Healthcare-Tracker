# backend/tests/test_share_links.py
"""Share link creation, listing, revocation, and token security tests."""
from datetime import datetime, timedelta, timezone

import pytest

from app.models.user import Role
from app.services import user_service


def _admin(client, db):
    user_service.create_user(db, "linkadmin@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "linkadmin@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def _viewer(client, db):
    user_service.create_user(db, "linkviewer@example.com", "a-strong-passphrase-123", Role.viewer)
    client.post("/api/auth/login", json={"email": "linkviewer@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def _future(days=7):
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def _create_link(client, csrf, label="Test Link", sections=None, days=7):
    r = client.post(
        "/api/share-links",
        headers={"X-CSRF-Token": csrf},
        json={"label": label, "expires_at": _future(days), "allowed_sections": sections or []},
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_create_share_link_returns_token_url(client, db_session):
    csrf = _admin(client, db_session)
    data = _create_link(client, csrf)
    assert "token_url" in data
    assert data["token_url"].startswith("/guest?token=")
    assert data["revoked"] is False


def test_token_not_in_list_response(client, db_session):
    csrf = _admin(client, db_session)
    _create_link(client, csrf)
    r = client.get("/api/share-links")
    assert r.status_code == 200
    for link in r.json():
        assert "token_url" not in link
        assert "token_hash" not in link


def test_revoke_share_link(client, db_session):
    csrf = _admin(client, db_session)
    data = _create_link(client, csrf)
    link_id = data["id"]
    r = client.delete(f"/api/share-links/{link_id}", headers={"X-CSRF-Token": csrf})
    assert r.status_code == 204
    links = client.get("/api/share-links").json()
    link = next(l for l in links if l["id"] == link_id)
    assert link["revoked"] is True


def test_viewer_cannot_create_share_link(client, db_session):
    csrf = _viewer(client, db_session)
    r = client.post(
        "/api/share-links",
        headers={"X-CSRF-Token": csrf},
        json={"label": "Bad", "expires_at": _future(), "allowed_sections": []},
    )
    assert r.status_code == 403


def test_viewer_cannot_list_share_links(client, db_session):
    _admin(client, db_session)
    viewer_csrf = _viewer(client, db_session)
    r = client.get("/api/share-links")
    assert r.status_code in (401, 403)


def test_share_token_rejected_by_authenticated_endpoint(client, db_session):
    csrf = _admin(client, db_session)
    data = _create_link(client, csrf)
    token = data["token_url"].split("token=")[1]
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    r = client.get("/api/medications", cookies={"access_token": token})
    assert r.status_code == 401
