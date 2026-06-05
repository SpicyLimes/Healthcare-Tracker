import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuditAction(str, enum.Enum):
    create = "create"
    update = "update"
    delete = "delete"
    share_link_access = "share_link_access"


class ActorType(str, enum.Enum):
    user = "user"
    guest = "guest"


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    action: Mapped[AuditAction] = mapped_column(
        Enum(AuditAction, name="auditaction"), nullable=False
    )
    actor_type: Mapped[ActorType] = mapped_column(
        Enum(ActorType, name="actortype"), nullable=False
    )
    actor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    actor_share_link_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("share_links.id", ondelete="SET NULL"), nullable=True
    )
    section: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    record_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    detail: Mapped[Optional[str]] = mapped_column(String, nullable=True)
