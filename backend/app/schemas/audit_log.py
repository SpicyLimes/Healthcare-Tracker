# backend/app/schemas/audit_log.py
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.audit_log import AuditAction, ActorType


class AuditLogEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    timestamp: datetime
    action: AuditAction
    actor_type: ActorType
    actor_label: str          # computed: user email or share link label
    section: str | None
    record_id: str | None
    detail: str | None
    ai_response: str | None = None   # AI answer; null for every other action
