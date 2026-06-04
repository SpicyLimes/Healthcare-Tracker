import uuid
from datetime import datetime

import pytest
from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.services.crud_service import CRUDService
from app.services.errors import NotFoundError


class _Widget(Base):
    __tablename__ = "_test_widgets"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


@pytest.fixture
def widget_table(db_session):
    # Create the throwaway table on the test session's own connection so it
    # lives inside the same transaction that db_session rolls back. This avoids
    # a cross-connection lock: a separate DROP on the engine would block on the
    # still-open db_session transaction holding the table.
    bind = db_session.get_bind()
    _Widget.__table__.create(bind, checkfirst=True)
    yield


def test_create_sets_created_by_and_get_returns_it(db_session, widget_table):
    svc = CRUDService(_Widget)
    actor = uuid.uuid4()
    row = svc.create(db_session, {"name": "alpha"}, created_by=actor)
    assert row.name == "alpha"
    assert row.created_by == actor
    fetched = svc.get(db_session, row.id)
    assert fetched.id == row.id


def test_list_returns_all(db_session, widget_table):
    svc = CRUDService(_Widget)
    actor = uuid.uuid4()
    svc.create(db_session, {"name": "a"}, created_by=actor)
    svc.create(db_session, {"name": "b"}, created_by=actor)
    assert len(svc.list(db_session)) == 2


def test_get_missing_raises(db_session, widget_table):
    svc = CRUDService(_Widget)
    with pytest.raises(NotFoundError):
        svc.get(db_session, uuid.uuid4())


def test_update_patches_provided_fields(db_session, widget_table):
    svc = CRUDService(_Widget)
    actor = uuid.uuid4()
    row = svc.create(db_session, {"name": "old"}, created_by=actor)
    updated = svc.update(db_session, row.id, {"name": "new"})
    assert updated.name == "new"


def test_update_missing_raises(db_session, widget_table):
    svc = CRUDService(_Widget)
    with pytest.raises(NotFoundError):
        svc.update(db_session, uuid.uuid4(), {"name": "x"})


def test_delete_removes_row(db_session, widget_table):
    svc = CRUDService(_Widget)
    actor = uuid.uuid4()
    row = svc.create(db_session, {"name": "z"}, created_by=actor)
    svc.delete(db_session, row.id)
    with pytest.raises(NotFoundError):
        svc.get(db_session, row.id)


def test_delete_missing_raises(db_session, widget_table):
    svc = CRUDService(_Widget)
    with pytest.raises(NotFoundError):
        svc.delete(db_session, uuid.uuid4())
