from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.security.passwords import hash_password, validate_password_policy, verify_password
from app.security.tokens import generate_refresh_token, hash_refresh_token
from app.utils.email import normalize_email


class InvalidCurrentPasswordError(Exception):
    """Raised when the supplied current password is wrong."""


def authenticate(db: Session, email: str, password: str) -> User | None:
    """Return the user if email+password are valid and the account is active, else None."""
    user = db.scalar(select(User).where(User.email == normalize_email(email)))
    # NOTE: We return early without calling verify_password when the user is
    # missing or inactive, which is a known timing side-channel that could reveal
    # whether an email is registered. The login rate limit (10 req/min) makes
    # the signal economically useless to exploit.
    if user is None or not user.is_active:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user


def _prune_stale_refresh_tokens(db: Session) -> None:
    """Delete tokens expired/revoked more than 30 days ago.

    Called opportunistically on every token issue; the 30-day grace window
    keeps recent rows around for audit/debugging.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    db.execute(
        delete(RefreshToken).where(
            (RefreshToken.expires_at < cutoff) | (RefreshToken.revoked_at < cutoff)
        )
    )


def issue_refresh_token(db: Session, user: User) -> str:
    """Create and persist a refresh token; return the raw token (stored hashed)."""
    _prune_stale_refresh_tokens(db)
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
    db.flush()
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


def revoke_all_refresh_tokens_for_user(db: Session, user_id) -> None:
    """Revoke every active refresh token for a user (e.g. after a password change)."""
    now = datetime.now(timezone.utc)
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    db.flush()


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    """Verify current password, enforce policy, set the new password.

    Revokes all of the user's refresh tokens so stolen sessions die with the
    old password; the router re-issues a session for the requesting device.
    """
    if not verify_password(current_password, user.hashed_password):
        raise InvalidCurrentPasswordError()
    validate_password_policy(new_password)
    user.hashed_password = hash_password(new_password)
    user.must_change_password = False
    user.temp_password_expires_at = None
    revoke_all_refresh_tokens_for_user(db, user.id)
    db.flush()
