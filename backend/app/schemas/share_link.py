import uuid
from datetime import datetime, timezone
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict


def _must_be_future(v: datetime) -> datetime:
    if v.astimezone(timezone.utc) <= datetime.now(timezone.utc):
        raise ValueError("expires_at must be in the future")
    return v


FutureDatetime = Annotated[datetime, AfterValidator(_must_be_future)]


class ShareLinkCreate(BaseModel):
    label: str
    expires_at: FutureDatetime
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
