import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.user import Role, User
from app.security.passwords import hash_password, validate_password_policy
from app.utils.email import normalize_email


class LastAdminError(Exception):
    """Raised when an operation would remove or demote the last admin."""


class UserNotFoundError(Exception):
    """Raised when a user id does not exist."""


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


def update_user(db: Session, user_id: uuid.UUID, role: Role | None, is_active: bool | None) -> User:
    user = get_user(db, user_id)
    # Guard: don't demote or deactivate the last admin
    if user.role == Role.admin and _admin_count(db) == 1:
        if (role is not None and role != Role.admin) or (is_active is False):
            raise LastAdminError("Cannot demote or deactivate the last admin")
    if role is not None:
        user.role = role
    if is_active is not None:
        user.is_active = is_active
    db.flush()
    return user


def set_password(db: Session, user_id: uuid.UUID, new_password: str) -> User:
    validate_password_policy(new_password)
    user = get_user(db, user_id)
    user.hashed_password = hash_password(new_password)
    db.flush()
    return user


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
