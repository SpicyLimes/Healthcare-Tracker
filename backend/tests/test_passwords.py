import pytest

from app.security.passwords import (
    hash_password,
    verify_password,
    validate_password_policy,
    PasswordPolicyError,
)


def test_hash_and_verify_roundtrip():
    hashed = hash_password("correct horse battery staple")
    assert hashed != "correct horse battery staple"
    assert verify_password("correct horse battery staple", hashed) is True


def test_verify_rejects_wrong_password():
    hashed = hash_password("correct horse battery staple")
    assert verify_password("wrong password here!!", hashed) is False


def test_policy_accepts_strong_password():
    validate_password_policy("a-strong-passphrase-123")  # no raise


def test_policy_rejects_short_password():
    with pytest.raises(PasswordPolicyError):
        validate_password_policy("short1")
