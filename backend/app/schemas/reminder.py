# backend/app/schemas/reminder.py
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ReminderPageUpdate(BaseModel):
    layout: dict[str, Any]


class ReminderPageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    layout: dict[str, Any]
    updated_at: datetime | None = None
