from app.services.email_service import mask_email


def test_mask_email_normal():
    assert mask_email("dr.smith@hospital.com") == "d***@hospital.com"


def test_mask_email_single_char_local():
    assert mask_email("a@example.com") == "a***@example.com"


def test_mask_email_no_at_is_defensive():
    # Input is EmailStr-validated upstream; be defensive anyway.
    assert mask_email("weird") == "w***"


import pytest

import app.config as app_config
from app.services.email_service import (
    EmailMessage,
    EmailSendError,
    ConsoleEmailSender,
    SmtpEmailSender,
    get_email_sender,
)


def test_console_sender_does_not_raise_and_logs(caplog):
    msg = EmailMessage(to="d@x.com", subject="Hi", text_body="body")
    with caplog.at_level("INFO"):
        ConsoleEmailSender().send(msg)
    assert any("Hi" in r.message or "d@x.com" in r.message for r in caplog.records)


def test_factory_returns_console_by_default(monkeypatch):
    monkeypatch.setattr(app_config.settings, "email_backend", "console")
    assert isinstance(get_email_sender(), ConsoleEmailSender)


def test_factory_returns_smtp_when_configured(monkeypatch):
    monkeypatch.setattr(app_config.settings, "email_backend", "smtp")
    assert isinstance(get_email_sender(), SmtpEmailSender)


def test_smtp_sender_wraps_errors_in_email_send_error(monkeypatch):
    # Point smtp at an unreachable host so the connection fails fast; assert the
    # raw error is wrapped, not leaked.
    monkeypatch.setattr(app_config.settings, "smtp_host", "127.0.0.1")
    monkeypatch.setattr(app_config.settings, "smtp_port", 1)  # nothing listening
    monkeypatch.setattr(app_config.settings, "smtp_use_tls", False)
    msg = EmailMessage(to="d@x.com", subject="Hi", text_body="body")
    with pytest.raises(EmailSendError):
        SmtpEmailSender().send(msg)
