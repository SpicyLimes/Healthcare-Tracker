"""Provider-agnostic transactional email sending layer.

Both Share-Link delivery and (future) email-OTP reuse this. The router depends
on the EmailSender interface, never on smtplib directly, so providers can be
swapped via config alone.
"""
import html as html_lib
import logging
import re
import smtplib
import ssl
from dataclasses import dataclass
from datetime import datetime
from email.message import EmailMessage as MimeMessage
from typing import Optional, Protocol
from zoneinfo import ZoneInfo

from app.config import settings
from app.models.user import Role

logger = logging.getLogger(__name__)


def mask_email(address: str) -> str:
    """Mask a recipient for audit logs: 'dr.smith@hospital.com' -> 'd***@hospital.com'.

    Defensive against malformed input (callers pass EmailStr-validated values).
    """
    if "@" in address:
        local, _, domain = address.partition("@")
        first = local[0] if local else ""
        return f"{first}***@{domain}"
    first = address[0] if address else ""
    return f"{first}***"


@dataclass
class EmailMessage:
    to: str
    subject: str
    text_body: str
    html_body: Optional[str] = None


class EmailSendError(Exception):
    """Raised when an email could not be sent. Never carries provider internals to the UI."""


class EmailSender(Protocol):
    def send(self, message: EmailMessage) -> None: ...


class ConsoleEmailSender:
    """Default sender: logs instead of sending. Used in dev and tests; never raises.

    The body is logged so dev flows (e.g. future email-OTP codes) stay visible,
    but the recipient is masked and share tokens are redacted — docker logs must
    never hold a live link.
    """

    def send(self, message: EmailMessage) -> None:
        redacted_body = re.sub(r"token=\S+", "token=<redacted>", message.text_body)
        # Temp passwords (Word-Word-NNNN! format) must never land in docker logs.
        redacted_body = re.sub(
            r"\b[A-Z][a-z]{3,5}-[A-Z][a-z]{3,5}-\d{4}!", "<redacted>", redacted_body
        )
        logger.info(
            "[ConsoleEmailSender] would send email to=%s subject=%r\n%s",
            mask_email(message.to),
            message.subject,
            redacted_body,
        )


class SmtpEmailSender:
    """Real SMTP sender via stdlib smtplib. Wraps all errors in EmailSendError."""

    def send(self, message: EmailMessage) -> None:
        mime = MimeMessage()
        mime["From"] = settings.email_from
        mime["To"] = message.to
        mime["Subject"] = message.subject
        mime.set_content(message.text_body)
        if message.html_body:
            mime.add_alternative(message.html_body, subtype="html")
        try:
            # Port 465 is implicit TLS (SMTPS): the socket is TLS from the first
            # byte, so STARTTLS must not be issued. Other ports (587) start plain
            # and upgrade via STARTTLS when smtp_use_tls is set.
            if settings.smtp_port == 465:
                connection = smtplib.SMTP_SSL(
                    settings.smtp_host,
                    settings.smtp_port,
                    timeout=10,
                    context=ssl.create_default_context(),
                )
            else:
                connection = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
            with connection as smtp:
                if settings.smtp_use_tls and settings.smtp_port != 465:
                    smtp.starttls(context=ssl.create_default_context())
                if settings.smtp_user:
                    smtp.login(settings.smtp_user, settings.smtp_password)
                smtp.send_message(mime)
        except Exception as exc:  # noqa: BLE001 — deliberately wrap everything
            logger.warning("SMTP send failed: %s", exc)
            raise EmailSendError("Email could not be sent") from exc


def get_email_sender() -> EmailSender:
    if settings.email_backend == "smtp":
        return SmtpEmailSender()
    return ConsoleEmailSender()


SHARE_LINK_SUBJECT = "A health summary has been shared with you"


def render_share_link_email(
    *, link_url: str, expires_at_display: str, message: Optional[str]
) -> tuple[str, str, str]:
    """Build (subject, text_body, html_body) for a shared-link email.

    Minimal by design: no patient identity, no sender identity, no health details.
    The optional admin `message` is rendered verbatim in text and HTML-escaped in HTML.
    """
    footer = settings.email_footer

    msg_block_text = ""
    if message:
        msg_block_text = (
            "\n── Message from the sender ──\n"
            f"{message}\n"
            "─────────────────────────────\n"
        )

    text_body = (
        "Hello,\n\n"
        "Someone has shared a health summary with you using Healthcare Tracker.\n"
        f"{msg_block_text}\n"
        "You can view the shared summary here:\n"
        f"{link_url}\n\n"
        f"This link expires on {expires_at_display}.\n"
        "If the link has expired, please ask the sender to share a new one.\n\n"
        "If you weren't expecting this email, you can safely ignore it.\n\n"
        "— Healthcare Tracker\n"
        f"{footer}\n"
    )

    safe_link = html_lib.escape(link_url, quote=True)
    safe_expiry = html_lib.escape(expires_at_display)
    safe_footer = html_lib.escape(footer)
    msg_block_html = ""
    if message:
        msg_block_html = (
            "<p style='border-left:3px solid #ccc;padding-left:12px;color:#555'>"
            f"{html_lib.escape(message)}</p>"
        )

    html_body = (
        "<p>Hello,</p>"
        "<p>Someone has shared a health summary with you using Healthcare Tracker.</p>"
        f"{msg_block_html}"
        f"<p>You can view the shared summary here:<br>"
        f"<a href=\"{safe_link}\">{safe_link}</a></p>"
        f"<p>This link expires on {safe_expiry}. "
        "If the link has expired, please ask the sender to share a new one.</p>"
        "<p>If you weren't expecting this email, you can safely ignore it.</p>"
        f"<p>— Healthcare Tracker<br>{safe_footer}</p>"
    )

    return SHARE_LINK_SUBJECT, text_body, html_body


def send_share_link_email(
    *,
    sender: EmailSender,
    recipient: str,
    link_url: str,
    expires_at_display: str,
    message: Optional[str],
) -> None:
    """Build and send a shared-link email via the injected sender."""
    subject, text_body, html_body = render_share_link_email(
        link_url=link_url, expires_at_display=expires_at_display, message=message
    )
    sender.send(
        EmailMessage(to=recipient, subject=subject, text_body=text_body, html_body=html_body)
    )


ONBOARDING_SUBJECT = "Welcome to HealthCare Tracker — Your Account is Ready"
RESET_SUBJECT = "Your HealthCare Tracker Password was Reset"

_ROLE_BLURBS = {
    Role.admin: (
        "You have full access: view and edit all records, manage users, "
        "share summaries, and change site settings."
    ),
    Role.contributor: (
        "You can view all health records and add or suggest changes. Your changes "
        "are submitted to an administrator for approval before they appear — you "
        "can track yours under My Submissions."
    ),
    Role.viewer: (
        "You can view all health records and use the shared Notes & To-Do lists. "
        "Other pages are read-only for your account."
    ),
}


def format_deadline(deadline_utc: datetime, tz_name: str) -> str:
    """Render a UTC deadline in the user's timezone, e.g. 'Friday, July 17 at 3:00 PM CDT'.

    Avoids the non-portable %-d / %-I strftime flags (musl inside the alpine image).
    """
    try:
        tz = ZoneInfo(tz_name)
    except Exception:  # noqa: BLE001 — bad stored zone falls back to UTC
        tz = ZoneInfo("UTC")
    local = deadline_utc.astimezone(tz)
    time_part = local.strftime("%I:%M %p").lstrip("0")
    return f"{local.strftime('%A, %B')} {local.day} at {time_part} {local.strftime('%Z')}"


def _admin_notes_blocks(notes: Optional[str]) -> tuple[str, str]:
    """(text_block, html_block) for the optional admin note; empty strings when absent."""
    if not notes:
        return "", ""
    text = (
        "\n── Note from your administrator ──\n"
        f"{notes}\n"
        "──────────────────────────────────\n"
    )
    html = (
        "<p style='border-left:3px solid #ccc;padding-left:12px;color:#555'>"
        f"{html_lib.escape(notes)}</p>"
    )
    return text, html


def _sign_in_blocks(temp_password: str, deadline_display: str) -> tuple[str, str]:
    """Shared sign-in steps + deadline warning, (text, html)."""
    base_url = settings.app_base_url
    text = (
        "How to sign in:\n"
        f"1. Go to {base_url}\n"
        "2. Sign in with this email address and your temporary password:\n\n"
        f"   {temp_password}\n\n"
        "3. You'll be asked to choose a new password right away.\n\n"
        f"IMPORTANT: This temporary password expires {deadline_display}.\n"
        "You must sign in AND set your new password before then, or your\n"
        "administrator will need to send you a new one.\n"
    )
    safe_url = html_lib.escape(base_url, quote=True)
    html = (
        "<p>How to sign in:</p>"
        "<ol>"
        f"<li>Go to <a href=\"{safe_url}\">{safe_url}</a></li>"
        "<li>Sign in with this email address and your temporary password:"
        f"<p style='font-family:monospace;font-size:16px;font-weight:bold'>{html_lib.escape(temp_password)}</p></li>"
        "<li>You'll be asked to choose a new password right away.</li>"
        "</ol>"
        f"<p><strong>IMPORTANT:</strong> This temporary password expires {html_lib.escape(deadline_display)}. "
        "You must sign in AND set your new password before then, or your "
        "administrator will need to send you a new one.</p>"
    )
    return text, html


def render_onboarding_email(
    *,
    recipient_name: Optional[str],
    role: Role,
    temp_password: str,
    deadline_display: str,
    notes: Optional[str],
) -> tuple[str, str, str]:
    """Build (subject, text_body, html_body) for the new-account onboarding email."""
    greeting = recipient_name or "there"
    blurb = _ROLE_BLURBS[role]
    role_label = role.value.capitalize()
    notes_text, notes_html = _admin_notes_blocks(notes)
    signin_text, signin_html = _sign_in_blocks(temp_password, deadline_display)
    footer = settings.email_footer

    text_body = (
        f"Hello {greeting},\n\n"
        "An account has been created for you on HealthCare Tracker, a private\n"
        "site for organizing and sharing our family's healthcare records.\n\n"
        f"Your role: {role_label}\n"
        f"{blurb}\n"
        f"{notes_text}\n"
        f"{signin_text}\n"
        "If you weren't expecting this email, you can safely ignore it.\n\n"
        "— HealthCare Tracker\n"
        f"{footer}\n"
    )

    html_body = (
        f"<p>Hello {html_lib.escape(greeting)},</p>"
        "<p>An account has been created for you on HealthCare Tracker, a private "
        "site for organizing and sharing our family's healthcare records.</p>"
        f"<p><strong>Your role: {html_lib.escape(role_label)}</strong><br>"
        f"{html_lib.escape(blurb)}</p>"
        f"{notes_html}"
        f"{signin_html}"
        "<p>If you weren't expecting this email, you can safely ignore it.</p>"
        f"<p>— HealthCare Tracker<br>{html_lib.escape(footer)}</p>"
    )

    return ONBOARDING_SUBJECT, text_body, html_body


def render_reset_email(
    *,
    recipient_name: Optional[str],
    temp_password: str,
    deadline_display: str,
    notes: Optional[str],
) -> tuple[str, str, str]:
    """Build (subject, text_body, html_body) for the admin password-reset email."""
    greeting = recipient_name or "there"
    notes_text, notes_html = _admin_notes_blocks(notes)
    signin_text, signin_html = _sign_in_blocks(temp_password, deadline_display)
    footer = settings.email_footer

    text_body = (
        f"Hello {greeting},\n\n"
        "An administrator has reset your HealthCare Tracker password. Your old\n"
        "password and any signed-in sessions no longer work.\n"
        f"{notes_text}\n"
        f"{signin_text}\n"
        "If you didn't ask for this reset, contact your administrator.\n\n"
        "— HealthCare Tracker\n"
        f"{footer}\n"
    )

    html_body = (
        f"<p>Hello {html_lib.escape(greeting)},</p>"
        "<p>An administrator has reset your HealthCare Tracker password. Your old "
        "password and any signed-in sessions no longer work.</p>"
        f"{notes_html}"
        f"{signin_html}"
        "<p>If you didn't ask for this reset, contact your administrator.</p>"
        f"<p>— HealthCare Tracker<br>{html_lib.escape(footer)}</p>"
    )

    return RESET_SUBJECT, text_body, html_body
