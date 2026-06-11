import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.limiter import limiter
from app.models.audit_log import AuditAction, ActorType
from app.models.user import User
from app.schemas.ai import ChatRequest, ChatResponse
from app.security.dependencies import require_admin, verify_csrf
from app.services import ai_agent, ai_provider, ai_settings_service
from app.services.audit_service import log_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["ai"])

_UNAVAILABLE = HTTPException(
    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
    detail="AI assistant is not available. Configure and enable it in Settings.",
)


@router.post("/chat", response_model=ChatResponse,
             dependencies=[Depends(require_admin), Depends(verify_csrf)])
@limiter.limit("20/minute")
def chat(
    request: Request,
    response: Response,
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    s = ai_settings_service.get_settings(db)
    if not s.enabled or not s.base_url or not s.model:
        raise _UNAVAILABLE

    messages = [{"role": m.role, "content": m.content} for m in payload.messages]
    try:
        result = ai_agent.run_chat(db, s, messages)
    except ai_provider.ProviderUnavailable:
        raise _UNAVAILABLE

    last_user = next((m.content for m in reversed(payload.messages) if m.role == "user"), "")
    try:
        log_event(
            db, action=AuditAction.ai_query, actor_type=ActorType.user, actor_user_id=current.id,
            section="ai_chat",
            detail=f"Q: {last_user[:500]} | tools: {','.join(result.tools_used) or 'none'}",
        )
        db.commit()
    except Exception:
        logger.exception("Audit log/commit failed for AI chat — ignoring")
        db.rollback()
    return result
