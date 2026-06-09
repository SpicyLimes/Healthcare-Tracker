import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit_log import AuditAction, ActorType
from app.models.user import User
from app.schemas.auth import SetPasswordRequest, UserCreateRequest, UserResponse, UserUpdateRequest
from app.security.dependencies import require_admin, verify_csrf
from app.security.passwords import PasswordPolicyError
from app.services import user_service
from app.services.audit_service import log_event

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserResponse], dependencies=[Depends(require_admin)])
def list_users(db: Session = Depends(get_db)):
    return user_service.list_users(db)


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
def create_user(
    payload: UserCreateRequest,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    try:
        user = user_service.create_user(db, payload.email, payload.password, payload.role)
    except PasswordPolicyError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    if payload.full_name:
        stripped = payload.full_name.strip()
        user.full_name = stripped if stripped else None
        db.commit()
        db.refresh(user)
    log_event(
        db,
        action=AuditAction.create,
        actor_type=ActorType.user,
        actor_user_id=current.id,
        detail=f"Admin created user: {user.email} role={user.role.value}",
    )
    return user


@router.put(
    "/{user_id}",
    response_model=UserResponse,
    dependencies=[Depends(verify_csrf)],
)
def update_user(
    user_id: uuid.UUID,
    payload: UserUpdateRequest,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    try:
        kwargs = {}
        if payload.full_name is not None or "full_name" in payload.model_fields_set:
            kwargs["full_name"] = payload.full_name
        updated = user_service.update_user(db, user_id, payload.role, payload.is_active, **kwargs)
    except user_service.LastAdminError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except user_service.UserNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    log_event(
        db,
        action=AuditAction.update,
        actor_type=ActorType.user,
        actor_user_id=current.id,
        detail=f"Admin updated user: {updated.email}",
    )
    return updated


@router.put(
    "/{user_id}/password",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf)],
)
def set_user_password(
    user_id: uuid.UUID,
    payload: SetPasswordRequest,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    try:
        target = user_service.set_password(db, user_id, payload.new_password)
    except PasswordPolicyError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except user_service.UserNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    log_event(
        db,
        action=AuditAction.update,
        actor_type=ActorType.user,
        actor_user_id=current.id,
        detail=f"Admin reset password for user: {target.email}",
    )


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf)],
)
def delete_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    try:
        target = user_service.get_user(db, user_id)
        email = target.email
        user_service.delete_user(db, user_id)
    except user_service.LastAdminError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except user_service.UserNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    log_event(
        db,
        action=AuditAction.delete,
        actor_type=ActorType.user,
        actor_user_id=current.id,
        detail=f"Admin deleted user: {email}",
    )
