import logging
from datetime import datetime, timezone

from app.models.user import Role
from app.services.email_service import (
    ConsoleEmailSender,
    EmailMessage,
    ONBOARDING_SUBJECT,
    RESET_SUBJECT,
    format_deadline,
    render_onboarding_email,
    render_reset_email,
)


def test_subjects_exact():
    assert ONBOARDING_SUBJECT == "Welcome to HealthCare Tracker — Your Account is Ready"
    assert RESET_SUBJECT == "Your HealthCare Tracker Password was Reset"


def test_format_deadline_in_user_timezone():
    dt = datetime(2026, 7, 17, 20, 0, tzinfo=timezone.utc)  # 3:00 PM CDT
    assert format_deadline(dt, "America/Chicago") == "Friday, July 17 at 3:00 PM CDT"


def test_format_deadline_bad_zone_falls_back_to_utc():
    dt = datetime(2026, 7, 17, 20, 0, tzinfo=timezone.utc)
    assert format_deadline(dt, "Not/AZone") == "Friday, July 17 at 8:00 PM UTC"


def test_onboarding_email_contents():
    subject, text, html = render_onboarding_email(
        recipient_name="Carol",
        role=Role.contributor,
        temp_password="Maple-Harbor-7482!",
        deadline_display="Friday, July 17 at 3:00 PM CDT",
        notes="Expect an email code from Cloudflare first.",
    )
    assert subject == ONBOARDING_SUBJECT
    assert "Hello Carol," in text
    assert "Your role: Contributor" in text
    assert "submitted to an administrator for approval" in text
    assert text.count("Maple-Harbor-7482!") == 1
    assert "Friday, July 17 at 3:00 PM CDT" in text
    assert "Expect an email code from Cloudflare first." in text
    assert "HealthCare Tracker" in text
    assert "Maple-Harbor-7482!" in html


def test_onboarding_email_no_name_no_notes():
    _, text, _ = render_onboarding_email(
        recipient_name=None, role=Role.viewer, temp_password="Pine-Reef-0001!",
        deadline_display="today", notes=None,
    )
    assert "Hello there," in text
    assert "Note from your administrator" not in text
    assert "read-only" in text


def test_reset_email_contents_and_html_escaping():
    subject, text, html = render_reset_email(
        recipient_name="Carol", temp_password="Pine-Reef-0001!",
        deadline_display="today", notes="<b>call me</b>",
    )
    assert subject == RESET_SUBJECT
    assert "an administrator has reset" in text.lower()
    assert "Your role:" not in text  # reset variant has no role blurb
    assert "&lt;b&gt;call me&lt;/b&gt;" in html
    assert "<b>call me</b>" not in html


def test_console_sender_redacts_temp_password(caplog):
    with caplog.at_level(logging.INFO):
        ConsoleEmailSender().send(
            EmailMessage(to="x@example.com", subject="s", text_body="password:\n\n   Maple-Harbor-7482!\n")
        )
    assert "Maple-Harbor-7482!" not in caplog.text
    assert "<redacted>" in caplog.text
