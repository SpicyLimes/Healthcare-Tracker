from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.security.passwords import hash_password, validate_password_policy, verify_password
from app.security.tokens import generate_refresh_token, hash_refresh_token


class InvalidCurrentPasswordError(Exception):
    """Raised when the supplied current password is wrong."""


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def authenticate(db: Session, email: str, password: str) -> User | None:
    """Return the user if email+password are valid and the account is active, else None."""
    user = db.scalar(select(User).where(User.email == _normalize_email(email)))
    if user is None or not user.is_active:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def issue_refresh_token(db: Session, user: User) -> str:
    """Create and persist a refresh token; return the raw token (stored hashed)."""
    raw = generate_refresh_token()
    expires = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_ttl_days)
    record = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token(raw),
        expires_at=expires,
    )
    db.add(record)
    db.flush()
    return raw


def _active_refresh_record(db: Session, raw: str) -> RefreshToken | None:
    record = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw))
    )
    if record is None or record.revoked_at is not None:
        return None
    if record.expires_at <= datetime.now(timezone.utc):
        return None
    return record


def rotate_refresh_token(db: Session, raw: str) -> tuple[User, str] | None:
    """Validate a refresh token, revoke it, and issue a new one. Returns (user, new_raw) or None."""
    record = _active_refresh_record(db, raw)
    if record is None:
        return None
    record.revoked_at = datetime.now(timezone.utc)
    user = db.get(User, record.user_id)
    if user is None or not user.is_active:
        return None
    new_raw = issue_refresh_token(db, user)
    return user, new_raw


def revoke_refresh_token(db: Session, raw: str) -> None:
    """Revoke a refresh token if it exists and is still active (idempotent)."""
    record = _active_refresh_record(db, raw)
    if record is not None:
        record.revoked_at = datetime.now(timezone.utc)
        db.flush()


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    """Verify current password, enforce policy, set the new password."""
    if not verify_password(current_password, user.hashed_password):
        raise InvalidCurrentPasswordError()
    validate_password_policy(new_password)
    user.hashed_password = hash_password(new_password)
    db.flush()
