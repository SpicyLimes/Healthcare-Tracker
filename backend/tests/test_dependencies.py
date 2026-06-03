from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.security.dependencies import get_current_user


def test_get_current_user_rejects_missing_cookie():
    """Dependency wiring works on a throwaway app: no cookie -> 401."""
    probe = FastAPI()

    @probe.get("/whoami")
    def whoami(current=Depends(get_current_user)):
        return {"email": current.email}

    client = TestClient(probe)
    assert client.get("/whoami").status_code == 401
