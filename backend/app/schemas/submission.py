import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.submission import SubmissionAction, SubmissionStatus


class SubmissionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    submitted_by: uuid.UUID | None
    submitted_by_label: str
    section: str
    action: SubmissionAction
    record_id: str | None
    payload: dict[str, Any]
    status: SubmissionStatus
    reviewed_by: uuid.UUID | None
    reviewed_by_label: str | None
    reviewed_at: datetime | None
    reject_reason: str | None
    created_at: datetime


class ReviewRequest(BaseModel):
    reject_reason: str | None = None


class AmendRequest(BaseModel):
    payload: dict[str, Any]
