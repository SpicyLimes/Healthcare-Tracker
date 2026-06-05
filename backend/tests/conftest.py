import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.config as app_config
from app.limiter import limiter
from app.main import app
from app.database import Base, get_db

TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://healthtracker:change-me-in-real-env@localhost:5432/healthtracker",
)


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(TEST_DB_URL)
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)


@pytest.fixture
def db_session(engine):
    """A transactional session rolled back after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    TestingSessionLocal = sessionmaker(bind=connection, autoflush=False, autocommit=False)
    session = TestingSessionLocal()
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    """TestClient whose DB dependency uses the rolled-back test session."""
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """Reset the slowapi limiter storage before each test to prevent cross-test bleed."""
    limiter._storage.reset()
    yield


@pytest.fixture(autouse=False)
def tmp_uploads_dir(tmp_path, monkeypatch):
    """Redirect all file uploads to a temporary directory for tests."""
    monkeypatch.setattr(app_config.settings, "uploads_root", str(tmp_path))
    return tmp_path
