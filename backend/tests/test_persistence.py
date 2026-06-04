"""Regression test proving `get_db` commits request-path writes.

The transactional `client` fixture rolls back after each test, so it cannot
catch a missing commit in `get_db`: every request-path write would silently
roll back while handlers still return success. This test exercises the real
`get_db` dependency directly and verifies the row is visible from a SEPARATE
connection after the dependency completes — i.e. that it actually committed.
"""
import os
import uuid

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.models.user import Role, User

DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://healthtracker:change-me-in-real-env@localhost:5432/healthtracker",
)


@pytest.fixture
def real_db_engine(monkeypatch):
    """Point the app's settings + engine at the reachable test DB, create tables."""
    # The app's get_db uses app.database.SessionLocal, which is bound to an engine
    # built from settings.database_url (default host 'db', unreachable locally).
    # Rebuild SessionLocal against the reachable test URL for this test.
    import app.database as database

    engine = create_engine(DB_URL)
    Base.metadata.create_all(engine)
    test_sessionmaker = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    monkeypatch.setattr(database, "SessionLocal", test_sessionmaker)

    with engine.begin() as conn:
        conn.execute(text("TRUNCATE refresh_tokens, users RESTART IDENTITY CASCADE"))
    yield engine
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE refresh_tokens, users RESTART IDENTITY CASCADE"))


def test_get_db_commits_writes(real_db_engine):
    """A write made through the real get_db dependency must persist (commit)."""
    new_id = uuid.uuid4()

    # Drive the get_db generator exactly as FastAPI does: get a session, do work,
    # then let the generator finish (which must commit).
    gen = get_db()
    db = next(gen)
    db.add(
        User(
            id=new_id,
            email="persisted@example.com",
            hashed_password="x" * 20,
            role=Role.viewer,
            is_active=True,
        )
    )
    # Completing the generator triggers the commit-on-success path in get_db.
    try:
        next(gen)
    except StopIteration:
        pass

    # Verify from a SEPARATE connection that the row was committed.
    verify_engine = create_engine(DB_URL)
    VerifySession = sessionmaker(bind=verify_engine)
    verify = VerifySession()
    try:
        found = verify.execute(
            text("SELECT email FROM users WHERE id = :id"), {"id": new_id}
        ).scalar()
    finally:
        verify.close()
        verify_engine.dispose()

    assert found == "persisted@example.com", (
        "get_db must commit on success; the row was not visible from a fresh "
        "connection, meaning the write rolled back."
    )


def test_get_db_rolls_back_on_exception(real_db_engine):
    """If the handler raises, get_db must roll back (no partial persistence)."""
    new_id = uuid.uuid4()
    gen = get_db()
    db = next(gen)
    db.add(
        User(
            id=new_id,
            email="rolledback@example.com",
            hashed_password="x" * 20,
            role=Role.viewer,
            is_active=True,
        )
    )
    # Simulate a handler error by throwing into the generator; get_db should
    # roll back and re-raise.
    with pytest.raises(RuntimeError):
        gen.throw(RuntimeError("handler failed"))

    verify_engine = create_engine(DB_URL)
    VerifySession = sessionmaker(bind=verify_engine)
    verify = VerifySession()
    try:
        found = verify.execute(
            text("SELECT email FROM users WHERE id = :id"), {"id": new_id}
        ).scalar()
    finally:
        verify.close()
        verify_engine.dispose()

    assert found is None, "get_db must roll back when the handler raises"
