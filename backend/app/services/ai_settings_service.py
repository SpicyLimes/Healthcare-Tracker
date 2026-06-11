from typing import Optional

from sqlalchemy.orm import Session

from app.models.ai_settings import AiSettings


def get_settings(db: Session) -> AiSettings:
    """Return the singleton row (id=1), creating a disabled default if absent."""
    row = db.get(AiSettings, 1)
    if row is None:
        row = AiSettings(id=1, enabled=False, base_url=None, model=None)
        db.add(row)
        db.flush()
    return row


def update_settings(
    db: Session,
    *,
    enabled: Optional[bool] = None,
    base_url: Optional[str] = None,
    model: Optional[str] = None,
) -> AiSettings:
    """Patch the singleton row. Only provided fields are changed."""
    row = get_settings(db)
    if enabled is not None:
        row.enabled = enabled
    if base_url is not None:
        row.base_url = base_url
    if model is not None:
        row.model = model
    db.flush()
    return row
