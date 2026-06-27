"""Tests for emailing a share link (POST /api/share-links/{id}/email)."""
from datetime import datetime, timedelta, timezone

import pytest

import app.services.email_service as email_service
from app.models.audit_log import AuditAction, AuditLog
from app.models.user import Role
from app.services import user_service


def _admin(client, db):
    user_service.create_user(db, "mailadmin@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "mailadmin@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def _viewer(client, db):
    user_service.create_user(db, "mailviewer@example.com", "a-strong-passphrase-123", Role.viewer)
    client.post("/api/auth/login", json={"email": "mailviewer@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def _future(days=7):
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def _create_link(client, csrf, label="Mail Link", days=7):
    r = client.post(
        "/api/share-links",
        headers={"X-CSRF-Token": csrf},
        json={"label": label, "expires_at": _future(days), "allowed_sections": []},
    )
    assert r.status_code == 201, r.text
    return r.json()


class _CapturingSender:
    def __init__(self):
        self.sent = []

    def send(self, message):
        self.sent.append(message)


class _FailingSender:
    def send(self, message):
        raise email_service.EmailSendError("boom")


def test_email_share_link_success_sends_and_audits(client, db_session, monkeypatch):
    csrf = _admin(client, db_session)
    link = _create_link(client, csrf)
    sender = _CapturingSender()
    monkeypatch.setattr(email_service, "get_email_sender", lambda: sender)

    r = client.post(
        f"/api/share-links/{link['id']}/email",
        headers={"X-CSRF-Token": csrf},
        json={"recipient": "dr.smith@hospital.com", "message": "See attached."},
    )
    assert r.status_code == 204, r.text

    # Email was built with the absolute link + the token.
    assert len(sender.sent) == 1
    body = sender.sent[0].text_body
    assert "/guest?token=" in body
    assert sender.sent[0].to == "dr.smith@hospital.com"

    # Audit row: masked recipient, label, NO token.
    rows = db_session.query(AuditLog).filter(AuditLog.action == AuditAction.share_link_emailed).all()
    assert len(rows) == 1
    assert "d***@hospital.com" in rows[0].detail
    assert "Mail Link" in rows[0].detail
    assert "token=" not in rows[0].detail


def test_email_inactive_link_rejected(client, db_session, monkeypatch):
    csrf = _admin(client, db_session)
    link = _create_link(client, csrf)
    # Revoke it, then try to email.
    client.delete(f"/api/share-links/{link['id']}", headers={"X-CSRF-Token": csrf})
    sender = _CapturingSender()
    monkeypatch.setattr(email_service, "get_email_sender", lambda: sender)

    r = client.post(
        f"/api/share-links/{link['id']}/email",
        headers={"X-CSRF-Token": csrf},
        json={"recipient": "dr@x.com"},
    )
    assert r.status_code == 400
    assert sender.sent == []


def test_email_missing_link_returns_404(client, db_session):
    csrf = _admin(client, db_session)
    r = client.post(
        "/api/share-links/00000000-0000-0000-0000-000000000000/email",
        headers={"X-CSRF-Token": csrf},
        json={"recipient": "dr@x.com"},
    )
    assert r.status_code == 404


def test_email_send_failure_returns_502_clean_and_no_audit(client, db_session, monkeypatch):
    csrf = _admin(client, db_session)
    link = _create_link(client, csrf)
    monkeypatch.setattr(email_service, "get_email_sender", lambda: _FailingSender())

    r = client.post(
        f"/api/share-links/{link['id']}/email",
        headers={"X-CSRF-Token": csrf},
        json={"recipient": "dr@x.com"},
    )
    assert r.status_code == 502
    assert "boom" not in r.text  # provider error not leaked
    assert "still valid" in r.json()["detail"]
    rows = db_session.query(AuditLog).filter(AuditLog.action == AuditAction.share_link_emailed).all()
    assert rows == []


def test_viewer_cannot_email_share_link(client, db_session, monkeypatch):
    admin_csrf = _admin(client, db_session)
    link = _create_link(client, admin_csrf)
    viewer_csrf = _viewer(client, db_session)  # now logged in as viewer
    r = client.post(
        f"/api/share-links/{link['id']}/email",
        headers={"X-CSRF-Token": viewer_csrf},
        json={"recipient": "dr@x.com"},
    )
    assert r.status_code == 403


def test_email_without_csrf_rejected(client, db_session):
    csrf = _admin(client, db_session)
    link = _create_link(client, csrf)
    r = client.post(
        f"/api/share-links/{link['id']}/email",
        json={"recipient": "dr@x.com"},  # no X-CSRF-Token header
    )
    assert r.status_code == 403


def test_email_invalid_recipient_returns_422(client, db_session):
    csrf = _admin(client, db_session)
    link = _create_link(client, csrf)
    r = client.post(
        f"/api/share-links/{link['id']}/email",
        headers={"X-CSRF-Token": csrf},
        json={"recipient": "not-an-email"},
    )
    assert r.status_code == 422
