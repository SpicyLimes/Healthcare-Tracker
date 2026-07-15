# backend/app/routers/reminders.py
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.reminder import ReminderPage
from app.models.user import User
from app.schemas.reminder import ReminderPageResponse, ReminderPageUpdate
from app.security.dependencies import require_admin, verify_csrf
from app.services.reminder_defaults import default_layout

router = APIRouter(prefix="/api/reminders", tags=["reminders"])


def _get_page(db: Session) -> ReminderPage | None:
    return db.execute(select(ReminderPage).order_by(ReminderPage.created_at).limit(1)).scalars().first()


@router.get("", response_model=ReminderPageResponse)
def get_reminder_page(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Return the saved sheet, or the default one if nothing is saved yet.

    Never 404s — a fresh install must render a usable sheet.
    """
    page = _get_page(db)
    if page is None:
        return ReminderPageResponse(layout=default_layout(), updated_at=None)
    return ReminderPageResponse(layout=page.layout, updated_at=page.updated_at)


@router.put("", response_model=ReminderPageResponse, dependencies=[Depends(verify_csrf)])
def put_reminder_page(
    payload: ReminderPageUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(require_admin),
):
    """Upsert the single reminder sheet."""
    page = _get_page(db)
    if page is None:
        page = ReminderPage(id=uuid.uuid4(), layout=payload.layout, updated_by=current.id)
        db.add(page)
    else:
        page.layout = payload.layout
        page.updated_by = current.id
    db.commit()
    db.refresh(page)
    return ReminderPageResponse(layout=page.layout, updated_at=page.updated_at)
