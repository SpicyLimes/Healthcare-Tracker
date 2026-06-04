# backend/app/services/documents.py
import logging
import os
import uuid
from typing import Optional

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models.document import Document, DocumentSection

logger = logging.getLogger(__name__)

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
}

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

INLINE_MIME_TYPES = {"application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp"}


def save_document(
    db: Session,
    file: UploadFile,
    section: DocumentSection,
    record_id: str,
    uploaded_by_id: uuid.UUID,
) -> Document:
    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File type '{content_type}' is not allowed.",
        )

    data = file.file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File exceeds the 20 MB size limit.",
        )

    safe_filename = os.path.basename(file.filename or "upload")
    stored_name = f"{uuid.uuid4()}_{safe_filename}"
    upload_dir = os.path.join(settings.uploads_root, section.value)
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, stored_name)
    with open(file_path, "wb") as f:
        f.write(data)

    doc = Document(
        filename=safe_filename,
        stored_filename=stored_name,
        section=section,
        record_id=str(record_id),
        mime_type=content_type,
        file_size=len(data),
        uploaded_by=uploaded_by_id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def delete_document(db: Session, doc_id: int) -> None:
    doc = db.get(Document, doc_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    file_path = os.path.join(settings.uploads_root, doc.section.value, doc.stored_filename)
    try:
        os.remove(file_path)
    except FileNotFoundError:
        logger.warning("File not found on disk during delete: %s", file_path)
    db.delete(doc)
    db.commit()


def delete_documents_for_record(db: Session, section: DocumentSection, record_id: str) -> None:
    docs = (
        db.query(Document)
        .filter(Document.section == section, Document.record_id == str(record_id))
        .all()
    )
    for doc in docs:
        file_path = os.path.join(settings.uploads_root, doc.section.value, doc.stored_filename)
        try:
            os.remove(file_path)
        except FileNotFoundError:
            logger.warning("File not found on disk during cascade delete: %s", file_path)
        db.delete(doc)
    db.commit()


def get_documents_for_record(
    db: Session, section: DocumentSection, record_id: str
) -> list[Document]:
    return (
        db.query(Document)
        .filter(Document.section == section, Document.record_id == str(record_id))
        .order_by(Document.uploaded_at.desc())
        .all()
    )


def get_all_documents(
    db: Session, section: Optional[DocumentSection] = None
) -> list[Document]:
    q = db.query(Document)
    if section is not None:
        q = q.filter(Document.section == section)
    return q.order_by(Document.uploaded_at.desc()).all()
