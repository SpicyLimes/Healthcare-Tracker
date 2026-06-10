# backend/app/schemas/summary.py
from datetime import date

from pydantic import BaseModel, Field


class SummaryRequest(BaseModel):
    """Selection payload for generating a One-Page Summary."""

    sections: list[str] = Field(default_factory=list, min_length=1)
    include_patient_header: bool = True
    include_documents: bool = False
    date_from: date | None = None
    date_to: date | None = None
    prepared_for: str | None = None
    title: str = "Patient Health Summary"
