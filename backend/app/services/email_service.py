"""Provider-agnostic transactional email sending layer.

Both Share-Link delivery and (future) email-OTP reuse this. The router depends
on the EmailSender interface, never on smtplib directly, so providers can be
swapped via config alone.
"""
import logging
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
    """Default sender: logs instead of sending. Used in dev and tests; never raises."""

    def send(self, message: EmailMessage) -> None:
        logger.info(
            "[ConsoleEmailSender] would send email to=%s subject=%r\n%s",
            message.to,
            message.subject,
            message.text_body,
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
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
                if settings.smtp_use_tls:
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
