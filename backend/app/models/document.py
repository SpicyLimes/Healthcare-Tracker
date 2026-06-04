# backend/app/models/document.py
import enum
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DocumentSection(str, enum.Enum):
    surgeries = "surgeries"
    hospitalizations = "hospitalizations"
    vision_history = "vision_history"
    dental_history = "dental_history"
    visit_logs = "visit_logs"
    appointments = "appointments"
    medications = "medications"
    vaccinations = "vaccinations"
    insurances = "insurances"
    ailments = "ailments"
    doctors = "doctors"
    profile = "profile"


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    filename: Mapped[str] = mapped_column(String, nullable=False)
    stored_filename: Mapped[str] = mapped_column(String, nullable=False)
    section: Mapped[DocumentSection] = mapped_column(
        Enum(DocumentSection, name="documentsection"), nullable=False
    )
    # Polymorphic reference — stores UUID of the owning record as string; no DB-level FK by design
    record_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    mime_type: Mapped[str] = mapped_column(String, nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    uploaded_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
