# backend/tests/test_migration_0037.py
import os

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

import app.config


def _base_url() -> str:
    return os.environ.get(
        "TEST_DATABASE_URL",
        "postgresql+psycopg://healthtracker:change-me-in-real-env@localhost:5432/healthtracker",
    )


@pytest.fixture
def fresh_db_url():
    base = _base_url()
    server = base.rsplit("/", 1)[0]
    admin = create_engine(server + "/postgres", isolation_level="AUTOCOMMIT")
    dbname = "mig0037_test"
    with admin.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {dbname} WITH (FORCE)"))
        conn.execute(text(f"CREATE DATABASE {dbname}"))
    yield server + f"/{dbname}"
    with admin.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {dbname} WITH (FORCE)"))
    admin.dispose()


def test_migration_0037_preserves_existing_notes(fresh_db_url, monkeypatch):
    """The reason a med is taken currently lives in free-text `notes`. Adding
    `used_for` must not read, move or alter a single character of that."""
    monkeypatch.setattr(app.config.settings, "database_url", fresh_db_url)
    cfg = Config("alembic.ini")

    command.upgrade(cfg, "0036")
    notes = "Medication for ADD/ADHD. Take with food."
    eng = create_engine(fresh_db_url)
    with eng.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO medications (id, name, kind, notes, is_active) "
                "VALUES (gen_random_uuid(), 'Ritalin', 'medication', :notes, true)"
            ),
            {"notes": notes},
        )
    eng.dispose()

    command.upgrade(cfg, "head")
    eng = create_engine(fresh_db_url)
    cols = {c["name"] for c in inspect(eng).get_columns("medications")}
    assert "used_for" in cols

    with eng.connect() as conn:
        row = conn.execute(text(
            "SELECT notes, used_for FROM medications WHERE name = 'Ritalin'"
        )).one()
    assert row[0] == notes      # notes byte-for-byte unchanged
    assert row[1] is None       # nothing parsed or backfilled
    eng.dispose()

    command.downgrade(cfg, "0036")
    eng = create_engine(fresh_db_url)
    cols = {c["name"] for c in inspect(eng).get_columns("medications")}
    assert "used_for" not in cols
    with eng.connect() as conn:
        assert conn.execute(text(
            "SELECT notes FROM medications WHERE name = 'Ritalin'"
        )).scalar() == notes
    eng.dispose()
