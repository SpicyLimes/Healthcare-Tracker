import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.document import Document, DocumentSection
from app.schemas.document import DocumentRead
from app.security.dependencies import get_current_user, require_admin, verify_csrf
from app.services.documents import delete_document, get_all_documents, INLINE_MIME_TYPES

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get("", response_model=list[DocumentRead], dependencies=[Depends(get_current_user)])
def list_documents(
    section: Optional[DocumentSection] = None,
    db: Session = Depends(get_db),
):
    return get_all_documents(db, section=section)


@router.get("/{doc_id}/download", dependencies=[Depends(get_current_user)])
def download_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.get(Document, doc_id)
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    file_path = os.path.join(settings.uploads_root, doc.section.value, doc.stored_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")
    disposition = "inline" if doc.mime_type in INLINE_MIME_TYPES else "attachment"
    # Let FileResponse build the Content-Disposition header (it RFC 5987-encodes
    # the filename safely); just tell it inline vs attachment.
    return FileResponse(
        path=file_path,
        media_type=doc.mime_type,
        filename=doc.filename,
        content_disposition_type=disposition,
    )


@router.delete(
    "/{doc_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_admin), Depends(verify_csrf)],
)
def delete_doc(doc_id: int, db: Session = Depends(get_db)):
    delete_document(db, doc_id)
