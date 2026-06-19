import logging

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.limiter import limiter
from app.models.audit_log import AuditAction, ActorType
from app.models.user import User
from app.schemas.settings import AiConnectionTest, AiSettingsRead, AiSettingsUpdate
from app.security.dependencies import require_admin, verify_csrf
from app.services import ai_provider, ai_settings_service
from app.services.audit_service import log_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/ai", response_model=AiSettingsRead, dependencies=[Depends(require_admin)])
@limiter.limit("30/minute")
def get_ai_settings(request: Request, response: Response, db: Session = Depends(get_db)):
    return ai_settings_service.get_settings(db)


@router.put("/ai", response_model=AiSettingsRead, dependencies=[Depends(require_admin), Depends(verify_csrf)])
@limiter.limit("30/minute")
def update_ai_settings(
    request: Request,
    response: Response,
    payload: AiSettingsUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    kwargs = payload.model_dump(exclude_unset=True)
    if not kwargs:
        # Empty patch: no-op, don't pollute the audit log with a false "updated" entry.
        return ai_settings_service.get_settings(db)
    row = ai_settings_service.update_settings(db, **kwargs)
    try:
        log_event(db, action=AuditAction.update, actor_type=ActorType.user,
                  actor_user_id=current.id, section="ai_settings", detail="Updated AI provider settings")
        db.commit()
    except Exception:
        logger.exception("Audit log/commit failed for AI settings update — rolling back")
        db.rollback()
        raise
    db.refresh(row)
    return row


@router.post("/ai/test", response_model=AiConnectionTest, dependencies=[Depends(require_admin), Depends(verify_csrf)])
@limiter.limit("10/minute")
def test_ai_connection(request: Request, response: Response, db: Session = Depends(get_db)):
    s = ai_settings_service.get_settings(db)
    if not s.base_url or not s.model:
        return AiConnectionTest(reachable=False, detail="Base URL and model are not configured.")
    ok, detail = ai_provider.ping(s.base_url, s.model)
    return AiConnectionTest(reachable=ok, detail=detail)


@router.get("/ai/models", response_model=list[str], dependencies=[Depends(require_admin)])
@limiter.limit("20/minute")
def list_ai_models(request: Request, response: Response, db: Session = Depends(get_db)):
    s = ai_settings_service.get_settings(db)
    if not s.base_url:
        return []
    return ai_provider.list_models(s.base_url)
