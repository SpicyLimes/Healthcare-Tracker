import pytest

from app.config import Settings


def _settings(**overrides):
    base = dict(
        jwt_secret="x" * 40,
        database_url="postgresql+psycopg://u:p@db:5432/d",
        initial_admin_password="a-strong-password-123",
    )
    base.update(overrides)
    return Settings(**base)


def test_email_settings_have_safe_defaults():
    s = _settings()
    assert s.email_backend == "console"
    assert s.smtp_port == 587
    assert s.smtp_use_tls is True
    assert s.email_from == "HealthCare Tracker <noreply@example.com>"
    assert s.email_footer == ""
    assert s.app_base_url == "http://localhost:1337"


@pytest.mark.parametrize("base_url", ["http://localhost:1337", "http://127.0.0.1:1337"])
def test_smtp_with_localhost_base_url_refuses_to_start(base_url):
    with pytest.raises(ValueError, match="APP_BASE_URL"):
        _settings(email_backend="smtp", app_base_url=base_url)


def test_console_with_localhost_base_url_is_fine():
    s = _settings(email_backend="console")
    assert s.app_base_url == "http://localhost:1337"


def test_smtp_with_public_base_url_is_fine():
    s = _settings(email_backend="smtp", app_base_url="https://healthcare.example.com")
    assert s.app_base_url == "https://healthcare.example.com"
