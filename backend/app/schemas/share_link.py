# backend/app/schemas/share_link.py
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ShareLinkCreate(BaseModel):
    label: str
    expires_at: datetime
    allowed_sections: list[str] = []


class ShareLinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    label: str
    allowed_sections: list[str]
    expires_at: datetime
    revoked: bool
    created_at: datetime


class ShareLinkCreated(ShareLinkRead):
    """Returned only at creation — includes the one-time raw token."""
    token_url: str
