import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, MeResponse
from app.security.cookies import REFRESH_COOKIE, clear_auth_cookies, set_auth_cookies
from app.security.dependencies import get_current_user, verify_csrf
from app.security.tokens import create_access_token
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _issue_session(db: Session, response: Response, user: User) -> None:
    access = create_access_token(user_id=str(user.id), role=user.role.value)
    refresh = auth_service.issue_refresh_token(db, user)
    csrf = secrets.token_urlsafe(32)
    set_auth_cookies(response, access, refresh, csrf)


@router.post("/login", response_model=MeResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = auth_service.authenticate(db, payload.email, payload.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    _issue_session(db, response, user)
    return user


@router.post("/refresh", response_model=MeResponse, dependencies=[Depends(verify_csrf)])
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    raw = request.cookies.get(REFRESH_COOKIE)
    result = auth_service.rotate_refresh_token(db, raw) if raw else None
    if result is None:
        clear_auth_cookies(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user, new_raw = result
    access = create_access_token(user_id=str(user.id), role=user.role.value)
    csrf = secrets.token_urlsafe(32)
    set_auth_cookies(response, access, new_raw, csrf)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(verify_csrf)])
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    raw = request.cookies.get(REFRESH_COOKIE)
    if raw:
        auth_service.revoke_refresh_token(db, raw)
    clear_auth_cookies(response)


@router.get("/me", response_model=MeResponse)
def me(current: User = Depends(get_current_user)):
    return current


@router.put("/password", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(verify_csrf)])
def change_password(
    payload: ChangePasswordRequest,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        auth_service.change_password(db, current, payload.current_password, payload.new_password)
    except auth_service.InvalidCurrentPasswordError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
