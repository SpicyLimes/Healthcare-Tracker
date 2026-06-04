import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.auth import SetPasswordRequest, UserCreateRequest, UserResponse, UserUpdateRequest
from app.security.dependencies import require_admin, verify_csrf
from app.security.passwords import PasswordPolicyError
from app.services import user_service

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserResponse], dependencies=[Depends(require_admin)])
def list_users(db: Session = Depends(get_db)):
    return user_service.list_users(db)


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)
def create_user(payload: UserCreateRequest, db: Session = Depends(get_db)):
    try:
        user = user_service.create_user(db, payload.email, payload.password, payload.role)
    except PasswordPolicyError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    return user


@router.put(
    "/{user_id}",
    response_model=UserResponse,
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)
def update_user(user_id: uuid.UUID, payload: UserUpdateRequest, db: Session = Depends(get_db)):
    try:
        return user_service.update_user(db, user_id, payload.role, payload.is_active)
    except user_service.LastAdminError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except user_service.UserNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")


@router.put(
    "/{user_id}/password",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)
def set_user_password(user_id: uuid.UUID, payload: SetPasswordRequest, db: Session = Depends(get_db)):
    try:
        user_service.set_password(db, user_id, payload.new_password)
    except PasswordPolicyError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except user_service.UserNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)
def delete_user(user_id: uuid.UUID, db: Session = Depends(get_db)):
    try:
        user_service.delete_user(db, user_id)
    except user_service.LastAdminError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except user_service.UserNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
