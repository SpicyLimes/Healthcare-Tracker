import pytest
from pydantic import ValidationError

from app.config import Settings


def test_insecure_jwt_secret_raises():
    with pytest.raises((ValidationError, ValueError)):
        Settings(
            jwt_secret="dev-only-insecure-secret-change-in-real-env",
            database_url="postgresql+psycopg://u:p@localhost/db",
            initial_admin_password="ValidPassword123!",
        )


def test_short_jwt_secret_raises():
    with pytest.raises((ValidationError, ValueError)):
        Settings(
            jwt_secret="tooshort",
            database_url="postgresql+psycopg://u:p@localhost/db",
            initial_admin_password="ValidPassword123!",
        )


def test_change_me_database_url_raises():
    with pytest.raises((ValidationError, ValueError)):
        Settings(
            jwt_secret="a" * 40,
            database_url="postgresql+psycopg://healthtracker:change-me-in-real-env@db:5432/healthtracker",
            initial_admin_password="ValidPassword123!",
        )


def test_change_me_admin_password_raises():
    with pytest.raises((ValidationError, ValueError)):
        Settings(
            jwt_secret="a" * 40,
            database_url="postgresql+psycopg://u:p@localhost/db",
            initial_admin_password="change-me-in-real-env",
        )


def test_valid_settings_does_not_raise():
    s = Settings(
        jwt_secret="a-long-secure-random-secret-that-is-definitely-long-enough",
        database_url="postgresql+psycopg://u:p@localhost/db",
        initial_admin_password="ValidStrongPassword1!",
    )
    assert s.jwt_secret.startswith("a-long")
