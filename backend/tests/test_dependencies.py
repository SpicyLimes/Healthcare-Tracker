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


def test_get_current_user_rejects_non_uuid_sub():
    """A validly-signed token whose sub is not a UUID must yield 401, not 500."""
    from fastapi import Depends, FastAPI
    from fastapi.testclient import TestClient
    from app.security.dependencies import get_current_user
    from app.security.tokens import create_access_token

    token = create_access_token(user_id="not-a-uuid", role="admin")

    probe = FastAPI()

    @probe.get("/whoami")
    def whoami(current=Depends(get_current_user)):
        return {"email": current.email}

    client = TestClient(probe)
    resp = client.get("/whoami", cookies={"access_token": token})
    assert resp.status_code == 401


def test_require_contributor_rejects_admin_and_viewer():
    import pytest
    from fastapi import HTTPException
    from app.security.dependencies import require_contributor
    from app.models.user import Role

    class U:
        def __init__(self, role): self.role = role

    # contributor passes
    u = U(Role.contributor)
    assert require_contributor(u) is u
    # admin and viewer are rejected
    for role in (Role.admin, Role.viewer):
        with pytest.raises(HTTPException) as ei:
            require_contributor(U(role))
        assert ei.value.status_code == 403
