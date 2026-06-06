# backend/tests/test_migration_0009.py
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
    dbname = "mig0009_test"
    with admin.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {dbname} WITH (FORCE)"))
        conn.execute(text(f"CREATE DATABASE {dbname}"))
    yield server + f"/{dbname}"
    with admin.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {dbname} WITH (FORCE)"))
    admin.dispose()


def test_migration_0009_round_trip(fresh_db_url, monkeypatch):
    monkeypatch.setattr(app.config.settings, "database_url", fresh_db_url)
    cfg = Config("alembic.ini")

    command.upgrade(cfg, "head")
    eng = create_engine(fresh_db_url)

    insp = inspect(eng)
    user_cols = {c["name"]: c for c in insp.get_columns("users")}
    assert "full_name" in user_cols
    assert user_cols["full_name"]["nullable"] is True

    eng.dispose()

    command.downgrade(cfg, "0008")
    eng = create_engine(fresh_db_url)
    user_cols_after = {c["name"] for c in inspect(eng).get_columns("users")}
    assert "full_name" not in user_cols_after
    eng.dispose()
