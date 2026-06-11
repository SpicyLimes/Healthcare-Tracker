from sqlalchemy.orm import Session

from app.models.ai_settings import AiSettings

_UNSET = object()


def get_settings(db: Session) -> AiSettings:
    """Return the singleton row (id=1), creating a disabled default if absent."""
    row = db.get(AiSettings, 1)
    if row is None:
        row = AiSettings(id=1, enabled=False, base_url=None, model=None)
        db.add(row)
        db.flush()
    return row


def update_settings(db: Session, *, enabled=_UNSET, base_url=_UNSET, model=_UNSET) -> AiSettings:
    """Patch the singleton row. Omitted args leave a field unchanged; passing an
    explicit value (including None) sets it. Returns the updated row."""
    row = get_settings(db)
    if enabled is not _UNSET:
        row.enabled = enabled
    if base_url is not _UNSET:
        row.base_url = base_url
    if model is not _UNSET:
        row.model = model
    db.flush()
    return row
