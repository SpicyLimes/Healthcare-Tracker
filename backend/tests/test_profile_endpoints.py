from app.models.user import Role
from app.services import user_service


def _admin_login(client, db_session):
    user_service.create_user(db_session, "admin@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "admin@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def _viewer_login(client, db_session):
    user_service.create_user(db_session, "viewer@example.com", "a-strong-passphrase-123", Role.viewer)
    client.post("/api/auth/login", json={"email": "viewer@example.com", "password": "a-strong-passphrase-123"})


def test_get_profile_404_when_unset(client, db_session):
    _admin_login(client, db_session)
    assert client.get("/api/profile").status_code == 404


def test_put_creates_then_updates_single_row(client, db_session):
    csrf = _admin_login(client, db_session)
    created = client.put("/api/profile", headers={"X-CSRF-Token": csrf},
                         json={"full_name": "Jane Doe", "blood_type": "O+"})
    assert created.status_code == 200
    first_id = created.json()["id"]
    assert created.json()["full_name"] == "Jane Doe"

    updated = client.put("/api/profile", headers={"X-CSRF-Token": csrf},
                         json={"full_name": "Jane A. Doe", "blood_type": "O-"})
    assert updated.status_code == 200
    # Same row reused (singleton), fields updated.
    assert updated.json()["id"] == first_id
    assert updated.json()["full_name"] == "Jane A. Doe"
    assert updated.json()["blood_type"] == "O-"

    got = client.get("/api/profile")
    assert got.status_code == 200
    assert got.json()["id"] == first_id


def test_viewer_can_read_not_write(client, db_session):
    csrf = _admin_login(client, db_session)
    client.put("/api/profile", headers={"X-CSRF-Token": csrf}, json={"full_name": "Jane Doe"})
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})

    _viewer_login(client, db_session)
    assert client.get("/api/profile").status_code == 200
    blocked = client.put("/api/profile", json={"full_name": "Hacker"})
    assert blocked.status_code == 403


def test_put_requires_csrf(client, db_session):
    _admin_login(client, db_session)
    assert client.put("/api/profile", json={"full_name": "X"}).status_code == 403


def test_get_requires_auth(client, db_session):
    assert client.get("/api/profile").status_code == 401
