# backend/app/schemas/audit_log.py
import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.audit_log import AuditAction, ActorType


class AuditLogEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    timestamp: datetime
    action: AuditAction
    actor_type: ActorType
    actor_label: str          # computed: user email or share link label
    section: Optional[str]
    record_id: Optional[str]
    detail: Optional[str]
