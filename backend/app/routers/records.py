import uuid
from typing import Type

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.security.dependencies import get_current_user, require_admin, verify_csrf
from app.services.crud_service import CRUDService
from app.services.errors import NotFoundError


def build_list_router(
    *,
    prefix: str,
    tag: str,
    model: type,
    create_schema: Type[BaseModel],
    update_schema: Type[BaseModel],
    response_schema: Type[BaseModel],
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
        dependencies=[Depends(require_admin), Depends(verify_csrf)],
    )
    def create_record(
        payload: create_schema,
        db: Session = Depends(get_db),
        current: User = Depends(require_admin),
    ):
        return service.create(db, payload.model_dump(), created_by=current.id)

    @router.put(
        "/{record_id}",
        response_model=response_schema,
        dependencies=[Depends(require_admin), Depends(verify_csrf)],
    )
    def update_record(record_id: uuid.UUID, payload: update_schema, db: Session = Depends(get_db)):
        try:
            return service.update(db, record_id, payload.model_dump(exclude_unset=True))
        except NotFoundError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    @router.delete(
        "/{record_id}",
        status_code=status.HTTP_204_NO_CONTENT,
        dependencies=[Depends(require_admin), Depends(verify_csrf)],
    )
    def delete_record(record_id: uuid.UUID, db: Session = Depends(get_db)):
        try:
            service.delete(db, record_id)
        except NotFoundError:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")

    return router
