"""Provider-agnostic transactional email sending layer.

Both Share-Link delivery and (future) email-OTP reuse this. The router depends
on the EmailSender interface, never on smtplib directly, so providers can be
swapped via config alone.
"""
import logging

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
