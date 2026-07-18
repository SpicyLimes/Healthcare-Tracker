import re

from app.models.user import Role
from app.security.passwords import MIN_PASSWORD_LENGTH, generate_temp_password, validate_password_policy
from app.services import user_service


def _admin_login(client, db_session):
    user_service.create_user(db_session, "admin@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "admin@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def test_new_user_defaults_no_temp_password_state(client, db_session):
    user = user_service.create_user(db_session, "u@example.com", "a-strong-passphrase-123", Role.viewer)
    assert user.must_change_password is False
    assert user.temp_password_expires_at is None


def test_me_and_user_list_expose_temp_password_fields(client, db_session):
    csrf = _admin_login(client, db_session)
    me = client.get("/api/auth/me").json()
    assert me["must_change_password"] is False
    listing = client.get("/api/users").json()
    assert listing[0]["must_change_password"] is False
    assert listing[0]["temp_password_expires_at"] is None


TEMP_FORMAT = re.compile(r"^[A-Z][a-z]{3,5}-[A-Z][a-z]{3,5}-\d{4}!$")


def test_generate_temp_password_format():
    for _ in range(50):
        pw = generate_temp_password()
        assert TEMP_FORMAT.match(pw), pw
        assert len(pw) >= MIN_PASSWORD_LENGTH
        validate_password_policy(pw)  # must not raise


def test_generate_temp_password_varies():
    assert len({generate_temp_password() for _ in range(50)}) > 40


from datetime import datetime, timedelta, timezone

import pytest

from app.security.passwords import verify_password
from app.services.email_service import EmailMessage, EmailSendError


class RecordingSender:
    def __init__(self):
        self.sent: list[EmailMessage] = []

    def send(self, message: EmailMessage) -> None:
        self.sent.append(message)


class FailingSender:
    def send(self, message: EmailMessage) -> None:
        raise EmailSendError("boom")


def test_issue_temp_password_success(client, db_session):
    user = user_service.create_user(db_session, "u@example.com", "a-strong-passphrase-123", Role.viewer)
    old_hash = user.hashed_password
    sender = RecordingSender()
    user_service.issue_temp_password(
        db_session, user, expires_minutes=60, email_kind="reset", notes=None, sender=sender
    )
    assert len(sender.sent) == 1
    assert sender.sent[0].to == "u@example.com"
    assert user.hashed_password != old_hash
    assert user.must_change_password is True
    remaining = user.temp_password_expires_at - datetime.now(timezone.utc)
    assert timedelta(minutes=58) < remaining < timedelta(minutes=61)
    # The plaintext temp appears in the email and matches the stored hash
    text = sender.sent[0].text_body
    temp = next(tok for tok in text.split() if tok.endswith("!") and tok.count("-") == 2)
    assert verify_password(temp, user.hashed_password)


def test_issue_temp_password_send_failure_changes_nothing(client, db_session):
    user = user_service.create_user(db_session, "u@example.com", "a-strong-passphrase-123", Role.viewer)
    old_hash = user.hashed_password
    with pytest.raises(EmailSendError):
        user_service.issue_temp_password(
            db_session, user, expires_minutes=60, email_kind="reset", notes=None, sender=FailingSender()
        )
    assert user.hashed_password == old_hash
    assert user.must_change_password is False
    assert user.temp_password_expires_at is None


def test_issue_temp_password_revokes_refresh_tokens(client, db_session):
    user = user_service.create_user(db_session, "u@example.com", "a-strong-passphrase-123", Role.viewer)
    from app.services import auth_service
    auth_service.issue_refresh_token(db_session, user)
    user_service.issue_temp_password(
        db_session, user, expires_minutes=60, email_kind="onboarding", notes=None, sender=RecordingSender()
    )
    from app.models.refresh_token import RefreshToken
    from sqlalchemy import select
    tokens = list(db_session.scalars(select(RefreshToken).where(RefreshToken.user_id == user.id)))
    assert tokens and all(t.revoked_at is not None for t in tokens)


def test_reset_password_endpoint_happy_path(client, db_session, monkeypatch):
    sender = RecordingSender()
    monkeypatch.setattr("app.routers.users.get_email_sender", lambda: sender)
    csrf = _admin_login(client, db_session)
    carol = user_service.create_user(db_session, "carol@example.com", "a-strong-passphrase-123", Role.viewer)
    resp = client.post(f"/api/users/{carol.id}/reset-password", headers={"X-CSRF-Token": csrf},
                       json={"expires_minutes": 60, "notes": "call me"})
    assert resp.status_code == 204
    assert len(sender.sent) == 1
    assert carol.must_change_password is True


def test_reset_password_invalid_expiry_rejected(client, db_session):
    csrf = _admin_login(client, db_session)
    carol = user_service.create_user(db_session, "carol@example.com", "a-strong-passphrase-123", Role.viewer)
    resp = client.post(f"/api/users/{carol.id}/reset-password", headers={"X-CSRF-Token": csrf},
                       json={"expires_minutes": 45})
    assert resp.status_code == 422


def test_reset_password_self_blocked(client, db_session):
    csrf = _admin_login(client, db_session)
    me = client.get("/api/auth/me").json()
    resp = client.post(f"/api/users/{me['id']}/reset-password", headers={"X-CSRF-Token": csrf},
                       json={"expires_minutes": 60})
    assert resp.status_code == 400


def test_reset_password_deactivated_blocked(client, db_session):
    csrf = _admin_login(client, db_session)
    carol = user_service.create_user(db_session, "carol@example.com", "a-strong-passphrase-123", Role.viewer)
    carol.is_active = False
    db_session.flush()
    resp = client.post(f"/api/users/{carol.id}/reset-password", headers={"X-CSRF-Token": csrf},
                       json={"expires_minutes": 60})
    assert resp.status_code == 409


def test_reset_password_email_failure_is_502_and_no_change(client, db_session, monkeypatch):
    monkeypatch.setattr("app.routers.users.get_email_sender", lambda: FailingSender())
    csrf = _admin_login(client, db_session)
    carol = user_service.create_user(db_session, "carol@example.com", "a-strong-passphrase-123", Role.viewer)
    old_hash = carol.hashed_password
    resp = client.post(f"/api/users/{carol.id}/reset-password", headers={"X-CSRF-Token": csrf},
                       json={"expires_minutes": 60})
    assert resp.status_code == 502
    assert carol.hashed_password == old_hash and carol.must_change_password is False


def test_reset_password_requires_admin(client, db_session):
    user_service.create_user(db_session, "v@example.com", "a-strong-passphrase-123", Role.viewer)
    client.post("/api/auth/login", json={"email": "v@example.com", "password": "a-strong-passphrase-123"})
    csrf = client.cookies.get("csrf_token")
    resp = client.post("/api/users/00000000-0000-0000-0000-000000000000/reset-password",
                       headers={"X-CSRF-Token": csrf}, json={"expires_minutes": 60})
    assert resp.status_code == 403


def test_create_user_with_onboarding_email(client, db_session, monkeypatch):
    sender = RecordingSender()
    monkeypatch.setattr("app.routers.users.get_email_sender", lambda: sender)
    csrf = _admin_login(client, db_session)
    resp = client.post("/api/users", headers={"X-CSRF-Token": csrf},
                       json={"email": "new@example.com", "role": "viewer", "full_name": "New Person",
                             "send_onboarding_email": True, "expires_minutes": 360, "notes": "hi"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["email_sent"] is True
    assert body["must_change_password"] is True
    assert len(sender.sent) == 1
    assert "Hello New Person," in sender.sent[0].text_body  # full_name set before send


def test_create_user_onboarding_email_failure_keeps_user(client, db_session, monkeypatch):
    monkeypatch.setattr("app.routers.users.get_email_sender", lambda: FailingSender())
    csrf = _admin_login(client, db_session)
    resp = client.post("/api/users", headers={"X-CSRF-Token": csrf},
                       json={"email": "new@example.com", "role": "viewer", "send_onboarding_email": True})
    assert resp.status_code == 201
    assert resp.json()["email_sent"] is False
    listing = client.get("/api/users").json()
    assert "new@example.com" in [u["email"] for u in listing]


def test_create_user_password_xor_onboarding(client, db_session):
    csrf = _admin_login(client, db_session)
    # neither password nor onboarding
    resp = client.post("/api/users", headers={"X-CSRF-Token": csrf},
                       json={"email": "a@example.com", "role": "viewer"})
    assert resp.status_code == 422
    # both password and onboarding
    resp = client.post("/api/users", headers={"X-CSRF-Token": csrf},
                       json={"email": "a@example.com", "role": "viewer",
                             "password": "a-strong-passphrase-123", "send_onboarding_email": True})
    assert resp.status_code == 422


def test_create_user_manual_mode_unchanged(client, db_session):
    csrf = _admin_login(client, db_session)
    resp = client.post("/api/users", headers={"X-CSRF-Token": csrf},
                       json={"email": "m@example.com", "password": "a-strong-passphrase-123", "role": "viewer"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["email_sent"] is None
    assert body["must_change_password"] is False
