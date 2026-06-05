# backend/app/routers/audit_log.py
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit_log import AuditAction, ActorType, AuditLog
from app.models.share_link import ShareLink
from app.models.user import User
from app.schemas.audit_log import AuditLogEntry
from app.security.dependencies import require_admin

router = APIRouter(prefix="/api/audit-log", tags=["audit-log"])

PAGE_SIZE = 50


@router.get("", response_model=list[AuditLogEntry], dependencies=[Depends(require_admin)])
def list_audit_log(
    page: int = Query(default=1, ge=1),
    action: Optional[AuditAction] = None,
    actor_type: Optional[ActorType] = None,
    section: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    if actor_type:
        q = q.filter(AuditLog.actor_type == actor_type)
    if section:
        q = q.filter(AuditLog.section == section)
    if date_from:
        q = q.filter(AuditLog.timestamp >= date_from)
    if date_to:
        from datetime import datetime, timezone
        end = datetime.combine(date_to, datetime.max.time()).replace(tzinfo=timezone.utc)
        q = q.filter(AuditLog.timestamp <= end)

    entries = q.order_by(AuditLog.timestamp.desc()).offset((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).all()

    result = []
    for entry in entries:
        if entry.actor_type == ActorType.user and entry.actor_user_id:
            user = db.get(User, entry.actor_user_id)
            actor_label = user.email if user else f"deleted user ({entry.actor_user_id})"
        elif entry.actor_type == ActorType.guest and entry.actor_share_link_id:
            link = db.get(ShareLink, entry.actor_share_link_id)
            actor_label = link.label if link else f"deleted link ({entry.actor_share_link_id})"
        else:
            actor_label = "unknown"

        result.append(AuditLogEntry(
            id=entry.id,
            timestamp=entry.timestamp,
            action=entry.action,
            actor_type=entry.actor_type,
            actor_label=actor_label,
            section=entry.section,
            record_id=entry.record_id,
            detail=entry.detail,
        ))
    return result
