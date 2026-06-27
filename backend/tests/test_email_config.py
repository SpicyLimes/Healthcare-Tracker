from app.config import Settings


def test_email_settings_have_safe_defaults():
    s = Settings(
        jwt_secret="x" * 40,
        database_url="postgresql+psycopg://u:p@db:5432/d",
        initial_admin_password="a-strong-password-123",
    )
    assert s.email_backend == "console"
    assert s.smtp_port == 587
    assert s.smtp_use_tls is True
    assert s.email_from == "Healthcare Tracker <noreply@example.com>"
    assert s.email_footer == ""
    assert s.app_base_url == "http://localhost:1337"
