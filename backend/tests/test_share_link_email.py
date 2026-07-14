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


@pytest.fixture
def smtp_backend(monkeypatch):
    """The email endpoint 501s in console mode; these tests inject fake senders anyway."""
    import app.config as app_config
    monkeypatch.setattr(app_config.settings, "email_backend", "smtp")


def test_email_share_link_success_sends_and_audits(client, db_session, monkeypatch, smtp_backend):
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


def test_email_inactive_link_rejected(client, db_session, monkeypatch, smtp_backend):
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


def test_email_missing_link_returns_404(client, db_session, smtp_backend):
    csrf = _admin(client, db_session)
    r = client.post(
        "/api/share-links/00000000-0000-0000-0000-000000000000/email",
        headers={"X-CSRF-Token": csrf},
        json={"recipient": "dr@x.com"},
    )
    assert r.status_code == 404


def test_email_send_failure_returns_502_clean_and_no_audit(client, db_session, monkeypatch, smtp_backend):
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


def test_email_console_backend_returns_501_and_no_audit(client, db_session, monkeypatch):
    """Default console backend must refuse loudly — a 204 would be silent data loss."""
    csrf = _admin(client, db_session)
    link = _create_link(client, csrf)
    sender = _CapturingSender()
    monkeypatch.setattr(email_service, "get_email_sender", lambda: sender)

    r = client.post(
        f"/api/share-links/{link['id']}/email",
        headers={"X-CSRF-Token": csrf},
        json={"recipient": "dr@x.com"},
    )
    assert r.status_code == 501
    assert "not configured" in r.json()["detail"]
    assert sender.sent == []
    rows = db_session.query(AuditLog).filter(AuditLog.action == AuditAction.share_link_emailed).all()
    assert rows == []


def test_email_status_unconfigured_for_console(client, db_session):
    csrf = _admin(client, db_session)
    r = client.get("/api/share-links/email-status")
    assert r.status_code == 200
    assert r.json() == {"configured": False}


def test_email_status_configured_for_smtp(client, db_session, smtp_backend):
    csrf = _admin(client, db_session)
    r = client.get("/api/share-links/email-status")
    assert r.status_code == 200
    assert r.json() == {"configured": True}


def test_email_status_requires_admin(client, db_session):
    _viewer(client, db_session)
    r = client.get("/api/share-links/email-status")
    assert r.status_code == 403


def test_email_expiry_rendered_in_admin_timezone(client, db_session, monkeypatch, smtp_backend):
    """The email must show the expiry in the sending admin's local time, matching the UI."""
    csrf = _admin(client, db_session)
    client.put("/api/auth/timezone", headers={"X-CSRF-Token": csrf}, json={"timezone": "America/Chicago"})
    r = client.post(
        "/api/share-links",
        headers={"X-CSRF-Token": csrf},
        json={"label": "TZ Link", "expires_at": "2026-08-01T22:30:00+00:00", "allowed_sections": []},
    )
    assert r.status_code == 201, r.text
    link = r.json()
    sender = _CapturingSender()
    monkeypatch.setattr(email_service, "get_email_sender", lambda: sender)

    resp = client.post(
        f"/api/share-links/{link['id']}/email",
        headers={"X-CSRF-Token": csrf},
        json={"recipient": "dr@x.com"},
    )
    assert resp.status_code == 204, resp.text
    body = sender.sent[0].text_body
    # 22:30 UTC on Aug 1 == 5:30 PM CDT the same day
    assert "August 01, 2026 05:30 PM CDT" in body
