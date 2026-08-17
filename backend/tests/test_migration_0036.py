# backend/tests/test_migration_0036.py
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
    dbname = "mig0036_test"
    with admin.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {dbname} WITH (FORCE)"))
        conn.execute(text(f"CREATE DATABASE {dbname}"))
    yield server + f"/{dbname}"
    with admin.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {dbname} WITH (FORCE)"))
    admin.dispose()


def test_migration_0036_round_trip(fresh_db_url, monkeypatch):
    """A single from-prod-state `upgrade head` must add both columns and leave
    pre-existing audit rows readable (NULL), then drop cleanly on downgrade."""
    monkeypatch.setattr(app.config.settings, "database_url", fresh_db_url)
    cfg = Config("alembic.ini")

    # Stop at 0035 = today's prod schema, and plant a legacy audit row.
    command.upgrade(cfg, "0035")
    eng = create_engine(fresh_db_url)
    with eng.begin() as conn:
        conn.execute(text(
            "INSERT INTO audit_log (action, actor_type, detail) "
            "VALUES ('login_failed', 'user', 'Failed login attempt: legacy@example.com')"
        ))
    eng.dispose()

    # ONE upgrade-head invocation, exactly as a prod deploy runs it.
    command.upgrade(cfg, "head")
    eng = create_engine(fresh_db_url)
    cols = {c["name"] for c in inspect(eng).get_columns("audit_log")}
    assert "attempted_identity" in cols
    assert "ai_response" in cols

    with eng.connect() as conn:
        row = conn.execute(text(
            "SELECT attempted_identity, ai_response FROM audit_log "
            "WHERE detail LIKE '%legacy@example.com%'"
        )).one()
    # Historical rows are not backfilled — they legitimately have no value.
    assert row[0] is None
    assert row[1] is None
    eng.dispose()

    command.downgrade(cfg, "0035")
    eng = create_engine(fresh_db_url)
    cols = {c["name"] for c in inspect(eng).get_columns("audit_log")}
    assert "attempted_identity" not in cols
    assert "ai_response" not in cols
    eng.dispose()
