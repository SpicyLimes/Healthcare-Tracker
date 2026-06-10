# backend/app/services/summary_service.py
from datetime import date
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.routers.guest import _get_section_map


def get_section_map() -> dict[str, tuple[Any, Any]]:
    """Reuse the guest router's section map (name -> (model, response schema))."""
    return _get_section_map()


def gather_section_rows(
    db: Session,
    section: str,
    date_from: Optional[date],
    date_to: Optional[date],
) -> list[dict[str, Any]]:
    """Return validated records for a section as plain dicts, optionally filtered by created_at date."""
    section_map = get_section_map()
    if section not in section_map:
        return []
    model, schema = section_map[section]
    rows = db.scalars(select(model)).all()
    result: list[dict[str, Any]] = []
    for row in rows:
        created = getattr(row, "created_at", None)
        if created is not None:
            created_date = created.date() if hasattr(created, "date") else created
            if date_from is not None and created_date < date_from:
                continue
            if date_to is not None and created_date > date_to:
                continue
        result.append(schema.model_validate(row).model_dump(mode="json"))
    return result
