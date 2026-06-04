import enum
import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AilmentStatus(str, enum.Enum):
    active = "active"
    resolved = "resolved"


class Ailment(Base):
    __tablename__ = "ailments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    condition: Mapped[str] = mapped_column(String, nullable=False)
    onset_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[AilmentStatus] = mapped_column(
        Enum(AilmentStatus, name="ailment_status"),
        nullable=False,
        default=AilmentStatus.active,
    )
    treating_doctor: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
