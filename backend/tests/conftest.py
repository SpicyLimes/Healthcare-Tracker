import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    """A TestClient for the FastAPI app."""
    return TestClient(app)
