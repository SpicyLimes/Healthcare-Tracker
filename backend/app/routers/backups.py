# backend/app/routers/backups.py
"""Admin-only backup management: list/create/download/upload/restore/delete."""
import os
from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from starlette.background import BackgroundTask

from app.database import get_db
from app.models.audit_log import ActorType, AuditAction
from app.models.user import User
from app.schemas.backup import BackupRead, RestoreRequest, RestoreResult
from app.security.dependencies import require_admin, verify_csrf
from app.services import backup_service
from app.services.audit_service import log_event

router = APIRouter(prefix="/api/backups", tags=["backups"])


@router.get("", response_model=list[BackupRead], dependencies=[Depends(require_admin)])
def list_backups():
    return [BackupRead(**asdict(i)) for i in backup_service.list_backups()]


@router.post(
    "",
    response_model=BackupRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
def create_backup(
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    try:
        info = backup_service.create_backup("manual")
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    log_event(
        db,
        action=AuditAction.backup_create,
        actor_type=ActorType.user,
        actor_user_id=current.id,
        detail=f"Manual backup created: {info.id}",
    )
    db.commit()
    return BackupRead(**asdict(info))


@router.get("/{backup_id}/download")
def download_backup(
    backup_id: str,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    try:
        tar_path = backup_service.build_download_tar(backup_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid backup id")
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backup not found or incomplete")
    log_event(
        db,
        action=AuditAction.backup_download,
        actor_type=ActorType.user,
        actor_user_id=current.id,
        detail=f"Downloaded backup: {backup_id}",
    )
    db.commit()
    return FileResponse(
        tar_path,
        media_type="application/x-tar",
        filename=f"healthcare-backup-{backup_id}.tar",
        background=BackgroundTask(os.unlink, tar_path),
    )


@router.post(
    "/upload",
    response_model=BackupRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
def upload_backup(
    file: UploadFile,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    try:
        info = backup_service.store_uploaded_tar(file.file)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    log_event(
        db,
        action=AuditAction.backup_upload,
        actor_type=ActorType.user,
        actor_user_id=current.id,
        detail=f"Uploaded backup: {info.id}",
    )
    db.commit()
    return BackupRead(**asdict(info))


@router.post(
    "/{backup_id}/restore",
    response_model=RestoreResult,
    dependencies=[Depends(verify_csrf)],
)
def restore_backup(
    backup_id: str,
    payload: RestoreRequest,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    if payload.confirm != backup_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation phrase does not match the backup name",
        )
    actor_id = current.id
    # Release this request's connection BEFORE the database is dropped; the
    # session transparently reconnects (to the restored DB) on next use.
    db.close()
    try:
        safety_id = backup_service.perform_restore(backup_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    # The restored DB may not contain the acting admin; NULL the FK if so.
    restored_actor = db.get(User, actor_id)
    log_event(
        db,
        action=AuditAction.backup_restore,
        actor_type=ActorType.user,
        actor_user_id=restored_actor.id if restored_actor else None,
        detail=f"Restored backup: {backup_id} (pre-restore safety: {safety_id})",
    )
    db.commit()
    return RestoreResult(safety_backup_id=safety_id)


@router.delete(
    "/{backup_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf)],
)
def delete_backup(
    backup_id: str,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    try:
        backup_service.delete_backup(backup_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid backup id")
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backup not found")
    log_event(
        db,
        action=AuditAction.backup_delete,
        actor_type=ActorType.user,
        actor_user_id=current.id,
        detail=f"Deleted backup: {backup_id}",
    )
    db.commit()
