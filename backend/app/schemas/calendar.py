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
    doctor_name: Optional[str] = None  # populated for appointment events
    time: Optional[str] = None         # HH:MM UTC, populated for appointment events
