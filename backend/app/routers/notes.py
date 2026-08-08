# backend/app/routers/notes.py
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.notes import Note
from app.models.user import Role, User
from app.schemas.notes import NoteCreate, NotePatch, NoteResponse
from app.security.dependencies import get_current_user, verify_csrf

router = APIRouter(prefix="/api/notes", tags=["notes"])


@router.get("", response_model=list[NoteResponse])
def list_notes(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    stmt = select(Note).order_by(Note.pinned.desc(), Note.created_at.desc())
    return db.execute(stmt).scalars().all()


@router.post(
    "",
    response_model=NoteResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf)],
)
def create_note(
    payload: NoteCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    note = Note(
        id=uuid.uuid4(),
        author_user_id=current.id,
        title=payload.title,
        body=payload.body,
        pinned=payload.pinned,
        done=payload.done,
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.patch(
    "/{note_id}",
    response_model=NoteResponse,
    dependencies=[Depends(verify_csrf)],
)
def patch_note(
    note_id: uuid.UUID,
    payload: NotePatch,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    note = db.get(Note, note_id)
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    if note.author_user_id != current.id and current.role != Role.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(note, field, value)
    db.commit()
    db.refresh(note)
    return note


@router.delete(
    "/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf)],
)
def delete_note(
    note_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
):
    note = db.get(Note, note_id)
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    # Same author-or-admin rule as patch_note. This was require_admin, which let
    # a viewer create and edit a note but never remove it — their own note became
    # undeletable by them, and the UI offered no delete control to explain why.
    if note.author_user_id != current.id and current.role != Role.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")
    db.delete(note)
    db.commit()
