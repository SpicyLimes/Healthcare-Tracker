# backend/app/services/audit_service.py
import logging
import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.models.audit_log import AuditAction, ActorType, AuditLog

logger = logging.getLogger(__name__)


def log_event(
    db: Session,
    action: AuditAction,
    actor_type: ActorType,
    section: Optional[str] = None,
    record_id: Optional[str] = None,
    detail: Optional[str] = None,
    actor_user_id: Optional[uuid.UUID] = None,
    actor_share_link_id: Optional[uuid.UUID] = None,
) -> None:
    """Write an audit log entry. Best-effort: never raises."""
    try:
        entry = AuditLog(
            action=action,
            actor_type=actor_type,
            actor_user_id=actor_user_id,
            actor_share_link_id=actor_share_link_id,
            section=section,
            record_id=record_id,
            detail=detail,
        )
        db.add(entry)
        db.flush()
    except Exception:
        logger.exception("Failed to write audit log entry — ignoring")
