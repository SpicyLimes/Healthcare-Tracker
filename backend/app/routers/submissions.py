import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select as sa_select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit_log import AuditAction, ActorType
from app.models.submission import Submission, SubmissionStatus
from app.schemas.submission import ReviewRequest, SubmissionRead
from app.security.dependencies import require_admin, verify_csrf
from app.services.audit_service import log_event
from app.services.submission_service import (
    AlreadyReviewedError,
    SubmissionNotFoundError,
    TargetRecordMissingError,
    approve_submission,
    list_submissions,
    reject_submission,
    to_read,
)

router = APIRouter(prefix="/api/submissions", tags=["submissions"])


@router.get("", response_model=list[SubmissionRead], dependencies=[Depends(require_admin)])
def list_all(
    status: SubmissionStatus | None = None,
    db: Session = Depends(get_db),
):
    subs = list_submissions(db, status=status)
    return [to_read(db, s) for s in subs]


@router.get("/pending-count", dependencies=[Depends(require_admin)])
def pending_count(db: Session = Depends(get_db)):
    count = db.scalar(
        sa_select(func.count()).select_from(Submission).where(
            Submission.status == SubmissionStatus.pending
        )
    ) or 0
    return {"count": count}


@router.post(
    "/{submission_id}/approve",
    response_model=SubmissionRead,
    dependencies=[Depends(verify_csrf)],
)
def approve(
    submission_id: uuid.UUID,
    db: Session = Depends(get_db),
    current=Depends(require_admin),
):
    try:
        sub = approve_submission(db, submission_id, current.id)
    except SubmissionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    except AlreadyReviewedError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already reviewed")
    except TargetRecordMissingError:
        # The record this submission targeted was deleted before approval. The
        # submission has been auto-rejected; persist that and tell the admin.
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The record this submission targets no longer exists; it has been auto-rejected.",
        )
    try:
        log_event(
            db,
            action=AuditAction.submission_approved,
            actor_type=ActorType.user,
            actor_user_id=current.id,
            section=sub.section,
            record_id=sub.record_id,
            detail=f"Approved submission {submission_id} ({sub.action.value} on {sub.section})",
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return to_read(db, sub)


@router.post(
    "/{submission_id}/reject",
    response_model=SubmissionRead,
    dependencies=[Depends(verify_csrf)],
)
def reject(
    submission_id: uuid.UUID,
    payload: ReviewRequest,
    db: Session = Depends(get_db),
    current=Depends(require_admin),
):
    try:
        sub = reject_submission(db, submission_id, current.id, payload.reject_reason)
    except SubmissionNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    except AlreadyReviewedError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already reviewed")
    try:
        log_event(
            db,
            action=AuditAction.submission_rejected,
            actor_type=ActorType.user,
            actor_user_id=current.id,
            section=sub.section,
            record_id=sub.record_id,
            detail=f"Rejected submission {submission_id}: {payload.reject_reason or 'no reason given'}",
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    return to_read(db, sub)
