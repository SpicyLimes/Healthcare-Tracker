import hmac
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import Cookie, Depends, Header, HTTPException, Query, Request, status
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
    if claims.get("type") == "share":
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


def require_contributor_or_admin(current: User = Depends(get_current_user)) -> User:
    """Allow admins and contributors; 403 for viewers and guests."""
    if current.role not in (Role.admin, Role.contributor):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Contributor or Admin required")
    return current


def require_contributor(current: User = Depends(get_current_user)) -> User:
    """Allow only contributors; 403 for admins, viewers, guests."""
    if current.role != Role.contributor:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Contributor required")
    return current


def require_authenticated(current: User = Depends(get_current_user)) -> User:
    """Allow any authenticated user regardless of role; 401 for unauthenticated."""
    return current


def verify_csrf(
    request: Request,
    x_csrf_token: str | None = Header(default=None),
) -> None:
    """Double-submit CSRF check for state-changing requests."""
    cookie_token = request.cookies.get("csrf_token")
    if not cookie_token or not x_csrf_token or not hmac.compare_digest(cookie_token, x_csrf_token):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF check failed")


@dataclass
class GuestContext:
    share_link_id: uuid.UUID
    allowed_sections: list[str]  # empty = all sections allowed


def get_guest_access(
    token: str = Query(..., alias="token"),
    db: Session = Depends(get_db),
) -> GuestContext:
    """Validate a guest share token. Returns GuestContext or raises 401/403."""
    import hashlib
    from app.models.share_link import ShareLink
    from app.security.tokens import decode_access_token, TokenError

    invalid = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired link")
    revoked_exc = HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This link has been revoked")

    try:
        claims = decode_access_token(token)
    except TokenError:
        raise invalid

    if claims.get("type") != "share":
        raise invalid

    try:
        link_id = uuid.UUID(claims["sub"])
    except (KeyError, ValueError):
        raise invalid

    link = db.get(ShareLink, link_id)
    if link is None:
        raise invalid

    # Verify the raw token matches the stored hash — prevents JWT forgery using a known link_id
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    if not hmac.compare_digest(link.token_hash, token_hash):
        raise invalid

    if link.revoked:
        raise revoked_exc
    if link.expires_at.astimezone(timezone.utc) < datetime.now(timezone.utc):
        raise invalid

    return GuestContext(share_link_id=link_id, allowed_sections=link.allowed_sections)


def require_guest_section_access(section: str, ctx: GuestContext) -> None:
    """Raise 403 if the guest token does not allow access to this section."""
    if ctx.allowed_sections and section not in ctx.allowed_sections:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This link does not grant access to section '{section}'",
        )
