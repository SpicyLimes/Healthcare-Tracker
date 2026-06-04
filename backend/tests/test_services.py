import uuid

import pytest

from app.models.user import Role, User
from app.security.passwords import verify_password
from app.services import user_service, auth_service


def test_create_user_hashes_password(db_session):
    user = user_service.create_user(db_session, "carol@example.com", "a-strong-passphrase-123", Role.viewer)
    assert user.email == "carol@example.com"
    assert user.hashed_password != "a-strong-passphrase-123"
    assert verify_password("a-strong-passphrase-123", user.hashed_password)


def test_create_user_rejects_weak_password(db_session):
    from app.security.passwords import PasswordPolicyError
    with pytest.raises(PasswordPolicyError):
        user_service.create_user(db_session, "x@example.com", "short", Role.viewer)


def test_create_user_lowercases_email(db_session):
    user = user_service.create_user(db_session, "MixedCase@Example.com", "a-strong-passphrase-123", Role.viewer)
    assert user.email == "mixedcase@example.com"


def test_seed_admin_creates_when_empty(db_session):
    created = user_service.seed_admin(db_session, "admin@example.com", "a-strong-passphrase-123")
    assert created is True
    assert db_session.query(User).filter_by(role=Role.admin).count() == 1


def test_seed_admin_noop_when_users_exist(db_session):
    user_service.create_user(db_session, "someone@example.com", "a-strong-passphrase-123", Role.viewer)
    created = user_service.seed_admin(db_session, "admin@example.com", "a-strong-passphrase-123")
    assert created is False


def test_authenticate_success(db_session):
    user_service.create_user(db_session, "carol@example.com", "a-strong-passphrase-123", Role.viewer)
    user = auth_service.authenticate(db_session, "carol@example.com", "a-strong-passphrase-123")
    assert user is not None
    assert user.email == "carol@example.com"


def test_authenticate_wrong_password(db_session):
    user_service.create_user(db_session, "carol@example.com", "a-strong-passphrase-123", Role.viewer)
    assert auth_service.authenticate(db_session, "carol@example.com", "wrong-passphrase-000") is None


def test_authenticate_unknown_email(db_session):
    assert auth_service.authenticate(db_session, "nobody@example.com", "whatever-passphrase") is None


def test_delete_last_admin_is_blocked(db_session):
    admin = user_service.create_user(db_session, "admin@example.com", "a-strong-passphrase-123", Role.admin)
    with pytest.raises(user_service.LastAdminError):
        user_service.delete_user(db_session, admin.id)


def test_change_password_updates_hash(db_session):
    user = user_service.create_user(db_session, "carol@example.com", "a-strong-passphrase-123", Role.viewer)
    auth_service.change_password(db_session, user, "a-strong-passphrase-123", "new-strong-passphrase-456")
    assert verify_password("new-strong-passphrase-456", user.hashed_password)


def test_change_password_rejects_wrong_current(db_session):
    user = user_service.create_user(db_session, "carol@example.com", "a-strong-passphrase-123", Role.viewer)
    with pytest.raises(auth_service.InvalidCurrentPasswordError):
        auth_service.change_password(db_session, user, "wrong-current-pass", "new-strong-passphrase-456")
