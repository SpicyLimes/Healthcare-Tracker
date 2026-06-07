# backend/app/schemas/calendar.py
from typing import Optional
from pydantic import BaseModel


class CalendarEventResponse(BaseModel):
    id: str
    type: str
    title: str
    date: str          # YYYY-MM-DD
    end_date: Optional[str] = None
    color: str
