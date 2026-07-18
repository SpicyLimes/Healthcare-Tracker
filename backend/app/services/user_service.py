import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.user import Role, User
from app.security.passwords import generate_temp_password, hash_password, validate_password_policy
from app.services import auth_service
from app.services.email_service import (
    EmailMessage,
    format_deadline,
    render_onboarding_email,
    render_reset_email,
)
from app.utils.email import normalize_email


class LastAdminError(Exception):
    """Raised when an operation would remove or demote the last admin."""


class UserNotFoundError(Exception):
    """Raised when a user id does not exist."""


_UNSET = object()


def _admin_count(db: Session) -> int:
    return db.scalar(select(func.count()).select_from(User).where(User.role == Role.admin)) or 0


def create_user(db: Session, email: str, password: str, role: Role) -> User:
    validate_password_policy(password)
    user = User(
        id=uuid.uuid4(),
        email=normalize_email(email),
        hashed_password=hash_password(password),
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def get_user(db: Session, user_id: uuid.UUID) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise UserNotFoundError(str(user_id))
    return user


def list_users(db: Session) -> list[User]:
    return list(db.scalars(select(User).order_by(User.created_at)))


def update_user(
    db: Session,
    user_id: uuid.UUID,
    role: Role | None,
    is_active: bool | None,
    full_name: object = _UNSET,
) -> User:
    user = get_user(db, user_id)
    # Guard: don't demote or deactivate the last admin
    if user.role == Role.admin and _admin_count(db) == 1:
        if (role is not None and role != Role.admin) or (is_active is False):
            raise LastAdminError("Cannot demote or deactivate the last admin")
    if role is not None:
        user.role = role
    if is_active is not None:
        user.is_active = is_active
    if full_name is not _UNSET:
        # None/""/whitespace-only all clear the name
        stripped = full_name.strip() if isinstance(full_name, str) else None
        user.full_name = stripped if stripped else None
    db.flush()
    return user


def set_password(db: Session, user_id: uuid.UUID, new_password: str) -> User:
    validate_password_policy(new_password)
    user = get_user(db, user_id)
    user.hashed_password = hash_password(new_password)
    user.must_change_password = False
    user.temp_password_expires_at = None
    # Admin reset: kill all existing sessions; the target logs in with the new password.
    auth_service.revoke_all_refresh_tokens_for_user(db, user.id)
    db.flush()
    return user


def issue_temp_password(
    db: Session,
    user: User,
    *,
    expires_minutes: int,
    email_kind: str,
    notes: str | None,
    sender,
) -> None:
    """Email the user a fresh temp password, then commit the credential swap.

    Send-first ordering: if the email fails (EmailSendError propagates), the
    user's current password, flags, and sessions are untouched.
    """
    temp = generate_temp_password()
    deadline = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)
    deadline_display = format_deadline(deadline, user.timezone)
    if email_kind == "onboarding":
        subject, text_body, html_body = render_onboarding_email(
            recipient_name=user.full_name, role=user.role, temp_password=temp,
            deadline_display=deadline_display, notes=notes,
        )
    elif email_kind == "reset":
        subject, text_body, html_body = render_reset_email(
            recipient_name=user.full_name, temp_password=temp,
            deadline_display=deadline_display, notes=notes,
        )
    else:
        raise ValueError(f"unknown email_kind: {email_kind!r}")
    sender.send(EmailMessage(to=user.email, subject=subject, text_body=text_body, html_body=html_body))
    user.hashed_password = hash_password(temp)
    user.must_change_password = True
    user.temp_password_expires_at = deadline
    auth_service.revoke_all_refresh_tokens_for_user(db, user.id)
    db.flush()


def delete_user(db: Session, user_id: uuid.UUID) -> None:
    user = get_user(db, user_id)
    if user.role == Role.admin and _admin_count(db) == 1:
        raise LastAdminError("Cannot delete the last admin")
    db.delete(user)
    db.flush()


def seed_admin(db: Session, email: str, password: str) -> bool:
    """Create the first admin if no users exist. Returns True if created."""
    existing = db.scalar(select(func.count()).select_from(User)) or 0
    if existing > 0:
        return False
    create_user(db, email, password, Role.admin)
    return True
