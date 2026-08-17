import logging

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.limiter import limiter
from app.models.audit_log import AuditAction, ActorType
from app.models.user import User
from app.schemas.ai import AiStatus, ChatRequest, ChatResponse
from app.models.user import Role
from app.security.dependencies import require_authenticated, verify_csrf
from app.services import ai_agent, ai_provider, ai_settings_service
from app.services.audit_service import log_event

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["ai"])

_UNAVAILABLE = HTTPException(
    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
    detail="AI assistant is not available. Configure and enable it in Settings.",
)

# Both halves of a logged AI exchange are clipped to the same budget. Answers
# are unbounded, and these rows are PHI that lands in every nightly backup, so
# the log keeps enough to see what was said without becoming a transcript store.
AUDIT_TEXT_LIMIT = 500


def _clip(text: str | None) -> str:
    if not text:
        return ""
    return text if len(text) <= AUDIT_TEXT_LIMIT else text[:AUDIT_TEXT_LIMIT] + "…"


@router.get("/status", response_model=AiStatus,
            dependencies=[Depends(require_authenticated)])
def status_(db: Session = Depends(get_db)):
    """Viewer-safe AI status for the chat panel. Returns only enabled+model so
    any authenticated user can tell whether to show the assistant; the local
    LLM base_url stays admin-only (see /api/settings/ai)."""
    s = ai_settings_service.get_settings(db)
    return AiStatus(enabled=s.enabled, model=s.model)


@router.post("/chat", response_model=ChatResponse,
             # require_authenticated is listed here (in addition to the `current`
             # param below) so authentication is evaluated BEFORE verify_csrf — an
             # anonymous caller gets 401, not a 403 that leaks the CSRF gate.
             dependencies=[Depends(require_authenticated), Depends(verify_csrf)])
@limiter.limit("20/minute")
def chat(
    request: Request,
    response: Response,
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current: User = Depends(require_authenticated),
):
    s = ai_settings_service.get_settings(db)
    if not s.enabled or not s.base_url or not s.model:
        raise _UNAVAILABLE

    messages = [{"role": m.role, "content": m.content} for m in payload.messages]
    # Viewers get read-only access — pass actor_id=None so write tools self-refuse.
    actor_id = current.id if current.role == Role.admin else None
    try:
        result = ai_agent.run_chat(db, s, messages, tz=current.timezone, actor_id=actor_id)
    except ai_provider.ProviderUnavailable:
        raise _UNAVAILABLE

    last_user = next((m.content for m in reversed(payload.messages) if m.role == "user" and m.content), "")
    try:
        log_event(
            db, action=AuditAction.ai_query, actor_type=ActorType.user, actor_user_id=current.id,
            section="ai_chat",
            detail=f"Q: {_clip(last_user)} | tools: {','.join(result.tools_used) or 'none'}",
            ai_response=_clip(result.answer),
        )
        db.commit()
    except Exception:
        logger.exception("Audit log/commit failed for AI chat — ignoring")
        db.rollback()
    return result
