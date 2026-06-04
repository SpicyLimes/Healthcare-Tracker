import uuid

from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import Role, User
from app.security.tokens import decode_access_token, TokenError

_CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
)


def get_current_user(
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the current user from the access-token cookie, or 401."""
    if not access_token:
        raise _CREDENTIALS_EXCEPTION
    try:
        claims = decode_access_token(access_token)
    except TokenError:
        raise _CREDENTIALS_EXCEPTION
    user_id = claims.get("sub")
    if not user_id:
        raise _CREDENTIALS_EXCEPTION
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise _CREDENTIALS_EXCEPTION
    user = db.get(User, uid)
    if user is None or not user.is_active:
        raise _CREDENTIALS_EXCEPTION
    return user


def require_admin(current: User = Depends(get_current_user)) -> User:
    """Allow only admins; 403 otherwise."""
    if current.role != Role.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin required")
    return current


def verify_csrf(
    request: Request,
    x_csrf_token: str | None = Header(default=None),
) -> None:
    """Double-submit CSRF check for state-changing requests."""
    cookie_token = request.cookies.get("csrf_token")
    if not cookie_token or not x_csrf_token or cookie_token != x_csrf_token:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF check failed")
