# backend/tests/test_guest_endpoints.py
"""Guest endpoint access: valid token, expired, revoked, section scoping."""
import hashlib
import uuid
from datetime import datetime, timedelta, timezone

import jwt as pyjwt
import pytest

from app.config import settings
from app.models.share_link import ShareLink
from app.models.user import Role
from app.services import user_service


def _admin(client, db):
    user_service.create_user(db, "guestadmin@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "guestadmin@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def _future(days=7):
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def _create_link(client, csrf, sections=None, days=7):
    r = client.post(
        "/api/share-links",
        headers={"X-CSRF-Token": csrf},
        json={"label": "Test", "expires_at": _future(days), "allowed_sections": sections or []},
    )
    assert r.status_code == 201
    return r.json()["token_url"].split("token=")[1]


def test_guest_can_list_sections(client, db_session):
    csrf = _admin(client, db_session)
    token = _create_link(client, csrf)
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    r = client.get(f"/api/guest/sections?token={token}")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    assert len(r.json()) == 12  # unscoped = all sections


def test_scoped_token_only_returns_allowed_sections(client, db_session):
    csrf = _admin(client, db_session)
    token = _create_link(client, csrf, sections=["medications", "vaccinations"])
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    r = client.get(f"/api/guest/sections?token={token}")
    assert r.status_code == 200
    assert set(r.json()) == {"medications", "vaccinations"}


def test_guest_can_list_allowed_section(client, db_session):
    csrf = _admin(client, db_session)
    token = _create_link(client, csrf, sections=["vaccinations"])
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    r = client.get(f"/api/guest/vaccinations?token={token}")
    assert r.status_code == 200


def test_guest_blocked_from_non_allowed_section(client, db_session):
    csrf = _admin(client, db_session)
    token = _create_link(client, csrf, sections=["vaccinations"])
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    r = client.get(f"/api/guest/medications?token={token}")
    assert r.status_code == 403


def test_expired_token_rejected(client, db_session):
    csrf = _admin(client, db_session)
    link_id = uuid.uuid4()
    past = datetime.now(timezone.utc) - timedelta(days=1)
    expired_token = pyjwt.encode(
        {"sub": str(link_id), "type": "share", "exp": past},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    token_hash = hashlib.sha256(expired_token.encode()).hexdigest()
    link = ShareLink(
        id=link_id,
        label="expired",
        token_hash=token_hash,
        allowed_sections=[],
        expires_at=past,
        revoked=False,
    )
    db_session.add(link)
    db_session.commit()
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    r = client.get(f"/api/guest/sections?token={expired_token}")
    assert r.status_code == 401


def test_revoked_token_rejected(client, db_session):
    csrf = _admin(client, db_session)
    data_raw = client.post(
        "/api/share-links",
        headers={"X-CSRF-Token": csrf},
        json={"label": "ToRevoke", "expires_at": _future(), "allowed_sections": []},
    )
    link_id = data_raw.json()["id"]
    token = data_raw.json()["token_url"].split("token=")[1]
    client.delete(f"/api/share-links/{link_id}", headers={"X-CSRF-Token": csrf})
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    r = client.get(f"/api/guest/sections?token={token}")
    assert r.status_code == 403


def test_guest_token_rejected_by_authenticated_endpoint(client, db_session):
    csrf = _admin(client, db_session)
    token = _create_link(client, csrf)
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    r = client.get("/api/medications", cookies={"access_token": token})
    assert r.status_code == 401
