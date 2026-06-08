# backend/app/schemas/notes.py
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NoteCreate(BaseModel):
    title: str
    body: str | None = None
    pinned: bool = False
    done: bool = False


class NotePatch(BaseModel):
    title: str | None = None
    body: str | None = None
    pinned: bool | None = None
    done: bool | None = None


class NoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    author_user_id: uuid.UUID
    title: str
    body: str | None
    pinned: bool
    done: bool
    created_at: datetime
