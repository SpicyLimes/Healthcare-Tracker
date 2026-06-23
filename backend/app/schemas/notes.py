# backend/app/schemas/notes.py
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class NoteCreate(BaseModel):
    title: str = Field(max_length=512)
    body: str | None = Field(default=None, max_length=50_000)
    pinned: bool = False
    done: bool = False


class NotePatch(BaseModel):
    title: str | None = Field(default=None, max_length=512)
    body: str | None = Field(default=None, max_length=50_000)
    pinned: bool | None = None
    done: bool | None = None

    @field_validator("title")
    @classmethod
    def title_not_null(cls, v: str | None) -> str | None:
        if v is None:
            raise ValueError("title cannot be null")
        return v


class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    author_user_id: uuid.UUID | None
    title: str
    body: str | None
    pinned: bool
    done: bool
    created_at: datetime
    updated_at: datetime
