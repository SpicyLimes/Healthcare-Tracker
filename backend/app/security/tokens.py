import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import jwt

from app.config import settings


class TokenError(Exception):
    """Raised when a token is invalid, tampered, or expired."""


def create_access_token(user_id: str, role: str, expires_delta: timedelta | None = None) -> str:
    """Create a signed JWT access token carrying the user id (sub) and role."""
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.access_token_ttl_minutes)
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT access token. Raises TokenError if invalid/expired."""
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc


def generate_refresh_token() -> str:
    """Generate a cryptographically random opaque refresh token."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(raw: str) -> str:
    """Hash a refresh token for storage (never store the raw token)."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def create_share_token(share_link_id: uuid.UUID, expires_at: datetime) -> str:
    """Create a signed JWT for a guest share link."""
    payload = {
        "sub": str(share_link_id),
        "type": "share",
        "exp": expires_at,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
