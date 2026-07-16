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


def _valid(**overrides) -> Settings:
    """Settings with the required secrets filled in, for exercising other fields."""
    return Settings(
        jwt_secret="a-long-secure-random-secret-that-is-definitely-long-enough",
        database_url="postgresql+psycopg://u:p@localhost/db",
        initial_admin_password="ValidStrongPassword1!",
        **overrides,
    )


def test_cors_origins_defaults_to_localhost():
    # A fresh clone must run without setting CORS_ALLOWED_ORIGINS.
    assert _valid().cors_origins_list == ["http://localhost:1337"]


def test_cors_origins_parses_single_origin():
    s = _valid(cors_allowed_origins="https://app.example.com")
    assert s.cors_origins_list == ["https://app.example.com"]


def test_cors_origins_parses_multiple_origins():
    s = _valid(
        cors_allowed_origins=(
            "https://app.example.com,https://old.example.com"
        )
    )
    assert s.cors_origins_list == [
        "https://app.example.com",
        "https://old.example.com",
    ]


def test_cors_origins_tolerates_whitespace_and_trailing_comma():
    s = _valid(
        cors_allowed_origins=" https://a.example.com , https://b.example.com , "
    )
    assert s.cors_origins_list == ["https://a.example.com", "https://b.example.com"]


def test_cors_origins_strips_trailing_slash():
    # A browser Origin header never has a path, so "https://x.com/" would
    # silently never match. Normalise rather than fail confusingly at runtime.
    s = _valid(cors_allowed_origins="https://app.example.com/")
    assert s.cors_origins_list == ["https://app.example.com"]


def test_cors_wildcard_origin_raises():
    # "*" plus allow_credentials=True would let any site on the internet make
    # authenticated requests with a logged-in user's cookies.
    with pytest.raises((ValidationError, ValueError)):
        _valid(cors_allowed_origins="*")


def test_cors_wildcard_among_valid_origins_raises():
    with pytest.raises((ValidationError, ValueError)):
        _valid(cors_allowed_origins="https://app.example.com,*")


def test_cors_empty_origins_raises():
    with pytest.raises((ValidationError, ValueError)):
        _valid(cors_allowed_origins="   ")


def test_cors_origin_without_scheme_raises():
    # "app.example.com" never matches an Origin header; fail at boot
    # rather than at 3am with an opaque CORS error in the browser console.
    with pytest.raises((ValidationError, ValueError)):
        _valid(cors_allowed_origins="app.example.com")
