# backend/app/schemas/document.py
from datetime import datetime
from typing import Optional
import uuid

from pydantic import BaseModel, ConfigDict

from app.models.document import DocumentSection


class DocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    filename: str
    section: DocumentSection
    record_id: Optional[str]
    mime_type: str
    file_size: int
    uploaded_at: datetime
    uploaded_by: Optional[uuid.UUID]
