# backend/app/schemas/backup.py
from datetime import datetime

from pydantic import BaseModel


class BackupRead(BaseModel):
    id: str
    type: str  # nightly | manual | safety | uploaded
    created_at: datetime
    size_bytes: int
    complete: bool


class RestoreRequest(BaseModel):
    confirm: str


class RestoreResult(BaseModel):
    safety_backup_id: str
