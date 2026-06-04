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
    dbname = "mig0002_test"
    with admin.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {dbname} WITH (FORCE)"))
        conn.execute(text(f"CREATE DATABASE {dbname}"))
    yield server + f"/{dbname}"
    with admin.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {dbname} WITH (FORCE)"))
    admin.dispose()


def test_migration_0002_round_trip(fresh_db_url, monkeypatch):
    # env.py reads settings.database_url at runtime, so point it at the fresh DB.
    monkeypatch.setattr(app.config.settings, "database_url", fresh_db_url)
    cfg = Config("alembic.ini")

    command.upgrade(cfg, "head")
    eng = create_engine(fresh_db_url)
    tables = set(inspect(eng).get_table_names())
    assert {"profile", "medications", "doctors", "ailments"}.issubset(tables)
    eng.dispose()

    command.downgrade(cfg, "base")
    eng = create_engine(fresh_db_url)
    tables = set(inspect(eng).get_table_names())
    assert "medications" not in tables
    assert "profile" not in tables
    eng.dispose()
