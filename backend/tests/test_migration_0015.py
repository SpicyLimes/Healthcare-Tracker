# backend/tests/test_migration_0015.py
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
    dbname = "mig0015_test"
    with admin.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {dbname} WITH (FORCE)"))
        conn.execute(text(f"CREATE DATABASE {dbname}"))
    yield server + f"/{dbname}"
    with admin.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {dbname} WITH (FORCE)"))
    admin.dispose()


def test_migration_0015_round_trip(fresh_db_url, monkeypatch):
    monkeypatch.setattr(app.config.settings, "database_url", fresh_db_url)
    cfg = Config("alembic.ini")

    command.upgrade(cfg, "head")
    eng = create_engine(fresh_db_url)

    insp = inspect(eng)
    assert "ai_settings" in insp.get_table_names()
    cols = {c["name"] for c in insp.get_columns("ai_settings")}
    assert cols == {"id", "enabled", "base_url", "model", "updated_at"}

    with eng.connect() as conn:
        rows = conn.execute(
            text("SELECT unnest(enum_range(NULL::auditaction))::text")
        ).scalars().all()
    assert "ai_query" in rows

    eng.dispose()

    command.downgrade(cfg, "0014")
    eng = create_engine(fresh_db_url)
    assert "ai_settings" not in inspect(eng).get_table_names()
    # Note: Do NOT assert ai_query is removed — Postgres cannot drop a single enum value.
    eng.dispose()
