import uuid
from typing import Any, Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import Base
from app.services.errors import NotFoundError

ModelT = TypeVar("ModelT", bound=Base)


class CRUDService(Generic[ModelT]):
    """Generic data-access for a record model. Flush-not-commit; get_db commits."""

    def __init__(self, model: type[ModelT]):
        self.model = model

    def list(self, db: Session) -> list[ModelT]:
        return list(db.scalars(select(self.model).order_by(self.model.created_at)))

    def get(self, db: Session, record_id: uuid.UUID) -> ModelT:
        row = db.get(self.model, record_id)
        if row is None:
            raise NotFoundError(str(record_id))
        return row

    def create(self, db: Session, data: dict[str, Any], created_by: uuid.UUID) -> ModelT:
        row = self.model(**data, created_by=created_by)
        db.add(row)
        db.flush()
        return row

    def update(self, db: Session, record_id: uuid.UUID, data: dict[str, Any]) -> ModelT:
        row = self.get(db, record_id)
        for key, value in data.items():
            setattr(row, key, value)
        db.flush()
        # Changing an FK column does not sync an already-loaded relationship
        # (e.g. Medication.pharmacy after pharmacy_id changes); expire so the
        # response serializes fresh values.
        db.expire(row)
        return row

    def delete(self, db: Session, record_id: uuid.UUID) -> None:
        row = self.get(db, record_id)
        db.delete(row)
        db.flush()
