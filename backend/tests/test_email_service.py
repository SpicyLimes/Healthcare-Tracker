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
    assert any("Hi" in r.getMessage() for r in caplog.records)


def test_console_sender_masks_recipient_and_redacts_token(caplog):
    """Docker logs must never hold a live share link or full recipient address."""
    msg = EmailMessage(
        to="dr.smith@hospital.com",
        subject="Hi",
        text_body="View here:\nhttps://app.example/guest?token=SECRETVALUE\nBye",
    )
    with caplog.at_level("INFO"):
        ConsoleEmailSender().send(msg)
    log = "\n".join(r.getMessage() for r in caplog.records)
    assert "SECRETVALUE" not in log
    assert "token=<redacted>" in log
    assert "dr.smith@hospital.com" not in log
    assert "d***@hospital.com" in log


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


from app.services.email_service import render_share_link_email, send_share_link_email


def test_render_share_link_email_includes_link_and_expiry():
    subject, text, html = render_share_link_email(
        link_url="https://app.example/guest?token=abc",
        expires_at_display="June 30, 2026 5:00 PM",
        message=None,
    )
    assert subject == "A health summary has been shared with you"
    assert "https://app.example/guest?token=abc" in text
    assert "June 30, 2026 5:00 PM" in text
    assert "<a" in html and "abc" in html


def test_render_includes_optional_message_and_escapes_html():
    _, text, html = render_share_link_email(
        link_url="https://app.example/guest?token=abc",
        expires_at_display="soon",
        message="Hi <script>alert(1)</script> Dr.",
    )
    assert "Hi <script>alert(1)</script> Dr." in text  # raw in plain text
    assert "<script>" not in html  # escaped in html
    assert "&lt;script&gt;" in html


def test_send_share_link_email_uses_injected_sender():
    sent = {}

    class FakeSender:
        def send(self, message):
            sent["msg"] = message

    send_share_link_email(
        sender=FakeSender(),
        recipient="dr@x.com",
        link_url="https://app.example/guest?token=abc",
        expires_at_display="soon",
        message=None,
    )
    assert sent["msg"].to == "dr@x.com"
    assert "abc" in sent["msg"].text_body
