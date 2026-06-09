import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict


def _must_be_future_and_within_cap(v: datetime) -> datetime:
    now = datetime.now(timezone.utc)
    if v.astimezone(timezone.utc) <= now:
        raise ValueError("expires_at must be in the future")
    if v.astimezone(timezone.utc) > now + timedelta(days=90):
        raise ValueError("expires_at cannot be more than 90 days in the future")
    return v


FutureDatetime = Annotated[datetime, AfterValidator(_must_be_future_and_within_cap)]


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
    token_url: str


class ShareLinkCreated(ShareLinkRead):
    """Returned at creation — token_url inherited from ShareLinkRead."""
    pass
