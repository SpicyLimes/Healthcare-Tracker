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
from email.message import EmailMessage as MimeMessage
from typing import Optional, Protocol

from app.config import settings

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
