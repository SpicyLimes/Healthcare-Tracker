# backend/tests/test_migration_0035.py
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
    dbname = "mig0035_test"
    with admin.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {dbname} WITH (FORCE)"))
        conn.execute(text(f"CREATE DATABASE {dbname}"))
    yield server + f"/{dbname}"
    with admin.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {dbname} WITH (FORCE)"))
    admin.dispose()


def test_migration_0035_round_trip(fresh_db_url, monkeypatch):
    monkeypatch.setattr(app.config.settings, "database_url", fresh_db_url)
    cfg = Config("alembic.ini")

    # Upgrade to just before 0035, insert a row, then upgrade so the
    # server_default backfills it to active.
    command.upgrade(cfg, "0034")
    eng = create_engine(fresh_db_url)
    with eng.begin() as conn:
        conn.execute(text(
            "INSERT INTO insurances (id, insurer_name) "
            "VALUES (gen_random_uuid(), 'Legacy Insurer')"
        ))
    eng.dispose()

    command.upgrade(cfg, "head")
    eng = create_engine(fresh_db_url)
    cols = {c["name"] for c in inspect(eng).get_columns("insurances")}
    assert "is_active" in cols
    with eng.connect() as conn:
        val = conn.execute(text(
            "SELECT is_active FROM insurances WHERE insurer_name = 'Legacy Insurer'"
        )).scalar()
    assert val is True
    eng.dispose()

    command.downgrade(cfg, "0034")
    eng = create_engine(fresh_db_url)
    cols = {c["name"] for c in inspect(eng).get_columns("insurances")}
    assert "is_active" not in cols
    eng.dispose()
