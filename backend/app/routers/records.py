import logging
import uuid as _uuid
import uuid
from typing import TYPE_CHECKING, Type

from fastapi import APIRouter, Depends, File as FastAPIFile, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit_log import AuditAction, ActorType
from app.models.submission import SubmissionAction
from app.models.user import Role, User
from app.security.dependencies import get_current_user, require_admin, require_contributor_or_admin, verify_csrf
from app.services.audit_service import log_event
from app.services.crud_service import CRUDService
from app.services.errors import NotFoundError

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from app.models.document import DocumentSection


def build_list_router(
    *,
    prefix: str,
    tag: str,
    model: type,
    create_schema: Type[BaseModel],
    update_schema: Type[BaseModel],
    response_schema: Type[BaseModel],
    document_section: "DocumentSection | None" = None,
) -> APIRouter:
    """Standard 5-endpoint CRUD router for a list-style record section."""
    router = APIRouter(prefix=prefix, tags=[tag])
    service = CRUDService(model)

    @router.get("", response_model=list[response_schema], dependencies=[Depends(get_current_user)])
    def list_records(db: Session = Depends(get_db)):
        return service.list(db)

    @router.get("/{record_id}", response_model=response_schema, dependencies=[Depends(get_current_user)])
    def get_record(record_id: uuid.UUID, db: Session = Depends(get_db)):
        try:
            return service.get(db, record_id)
        except NotFoundError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    @router.post(
        "",
        response_model=response_schema,
        status_code=status.HTTP_201_CREATED,
        dependencies=[Depends(verify_csrf)],
    )
    def create_record(
        payload: create_schema,
        db: Session = Depends(get_db),
        current: User = Depends(require_contributor_or_admin),
    ):
        section = prefix.removeprefix("/api/").replace("-", "_")
        if current.role == Role.contributor:
            from app.services.submission_service import create_submission, UnknownSectionError
            try:
                sub = create_submission(
                    db,
                    submitted_by_id=current.id,
                    section=section,
                    action=SubmissionAction.create,
                    payload=payload.model_dump(mode="json"),
                )
                log_event(
                    db,
                    action=AuditAction.submission_created,
                    actor_type=ActorType.user,
                    actor_user_id=current.id,
                    section=section,
                    detail=f"Contributor submitted create for {tag}",
                )
            except UnknownSectionError:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Section '{section}' does not support contributor submissions",
                )
            return response_schema.model_validate(
                {**payload.model_dump(), "id": sub.id, "created_at": sub.created_at, "updated_at": sub.created_at}
            )
        # Admin path — write directly
        record = service.create(db, payload.model_dump(), created_by=current.id)
        try:
            log_event(
                db,
                action=AuditAction.create,
                actor_type=ActorType.user,
                actor_user_id=current.id,
                section=section,
                record_id=str(record.id),
                detail=f"Created record in {tag}",
            )
        except Exception:
            logger.exception("Audit log failed for create in %s — ignoring", tag)
        return record

    @router.put(
        "/{record_id}",
        response_model=response_schema,
        dependencies=[Depends(verify_csrf)],
    )
    def update_record(
        record_id: uuid.UUID,
        payload: update_schema,
        db: Session = Depends(get_db),
        current: User = Depends(require_contributor_or_admin),
    ):
        section = prefix.removeprefix("/api/").replace("-", "_")
        if current.role == Role.contributor:
            from app.services.submission_service import create_submission, UnknownSectionError
            try:
                create_submission(
                    db,
                    submitted_by_id=current.id,
                    section=section,
                    action=SubmissionAction.update,
                    payload=payload.model_dump(exclude_unset=True, mode="json"),
                    record_id=str(record_id),
                )
                log_event(
                    db,
                    action=AuditAction.submission_created,
                    actor_type=ActorType.user,
                    actor_user_id=current.id,
                    section=section,
                    record_id=str(record_id),
                    detail=f"Contributor submitted update for {tag} record {record_id}",
                )
            except UnknownSectionError:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Section '{section}' does not support contributor submissions",
                )
            try:
                return service.get(db, record_id)
            except NotFoundError:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
        # Admin path
        try:
            record = service.update(db, record_id, payload.model_dump(exclude_unset=True))
        except NotFoundError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
        try:
            log_event(
                db,
                action=AuditAction.update,
                actor_type=ActorType.user,
                actor_user_id=current.id,
                section=section,
                record_id=str(record_id),
                detail=f"Updated record in {tag}",
            )
        except Exception:
            logger.exception("Audit log failed for update in %s — ignoring", tag)
        return record

    @router.delete(
        "/{record_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        dependencies=[Depends(verify_csrf)],
    )
    def delete_record(
        record_id: uuid.UUID,
        db: Session = Depends(get_db),
        current: User = Depends(require_contributor_or_admin),
    ):
        section = prefix.removeprefix("/api/").replace("-", "_")
        if current.role == Role.contributor:
            from app.services.submission_service import create_submission, UnknownSectionError
            try:
                create_submission(
                    db,
                    submitted_by_id=current.id,
                    section=section,
                    action=SubmissionAction.delete,
                    payload={},
                    record_id=str(record_id),
                )
                log_event(
                    db,
                    action=AuditAction.submission_created,
                    actor_type=ActorType.user,
                    actor_user_id=current.id,
                    section=section,
                    record_id=str(record_id),
                    detail=f"Contributor submitted delete for {tag} record {record_id}",
                )
            except UnknownSectionError:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Section '{section}' does not support contributor submissions",
                )
            return  # 204 No Content — submission queued
        # Admin path
        if document_section is not None:
            from app.services.documents import delete_documents_for_record
            delete_documents_for_record(db, document_section, str(record_id))
        try:
            service.delete(db, record_id)
        except NotFoundError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
        try:
            log_event(
                db,
                action=AuditAction.delete,
                actor_type=ActorType.user,
                actor_user_id=current.id,
                section=section,
                record_id=str(record_id),
                detail=f"Deleted record in {tag}",
            )
        except Exception:
            logger.exception("Audit log failed for delete in %s — ignoring", tag)

    if document_section is not None:
        attach_document_routes(router, document_section, model)

    return router


def attach_document_routes(
    router: APIRouter,
    section: "DocumentSection",
    model: type,
) -> None:
    """Add GET /{record_id}/documents and POST /{record_id}/documents to an existing router."""
    from app.models.document import DocumentSection as _DocumentSection
    from app.schemas.document import DocumentRead
    from app.services.documents import save_document, get_documents_for_record
    from app.models.user import User

    @router.get(
        "/{record_id}/documents",
        response_model=list[DocumentRead],
        dependencies=[Depends(get_current_user)],
    )
    def list_record_documents(record_id: _uuid.UUID, db: Session = Depends(get_db)):
        record = db.get(model, record_id)
        if record is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
        return get_documents_for_record(db, section, str(record_id))

    @router.post(
        "/{record_id}/documents",
        response_model=DocumentRead,
        status_code=status.HTTP_201_CREATED,
        dependencies=[Depends(verify_csrf)],
    )
    def upload_record_document(
        record_id: _uuid.UUID,
        file: UploadFile = FastAPIFile(...),
        db: Session = Depends(get_db),
        current: User = Depends(require_admin),
    ):
        record = db.get(model, record_id)
        if record is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
        return save_document(db, file, section, str(record_id), current.id)
