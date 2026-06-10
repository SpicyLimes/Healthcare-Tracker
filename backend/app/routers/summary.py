# backend/app/routers/summary.py
import logging

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.limiter import limiter
from app.models.audit_log import AuditAction, ActorType
from app.models.profile import Profile
from app.models.user import User
from app.schemas.records import ProfileResponse
from app.schemas.summary import SummaryRequest
from app.security.dependencies import require_admin, verify_csrf
from app.services import summary_service
from app.services.audit_service import log_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/summary", tags=["summary"])


def _get_patient(db: Session) -> dict | None:
    row = db.scalars(select(Profile)).first()
    return ProfileResponse.model_validate(row).model_dump(mode="json") if row else None


@router.post("", dependencies=[Depends(require_admin), Depends(verify_csrf)])
@limiter.limit("20/minute")
def generate_summary(
    request: Request,
    response: Response,
    payload: SummaryRequest,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    section_data = {
        s: summary_service.gather_section_rows(db, s, payload.date_from, payload.date_to)
        for s in payload.sections
    }
    patient = _get_patient(db)
    html = summary_service.render_summary(payload, section_data, patient)
    try:
        log_event(
            db,
            action=AuditAction.create,
            actor_type=ActorType.user,
            actor_user_id=current.id,
            section=",".join(payload.sections),
            detail=f"Generated summary ({len(payload.sections)} sections)",
        )
        db.commit()
    except Exception:
        logger.exception("Audit log failed for summary generation — ignoring")
        db.rollback()
    return HTMLResponse(content=html)
