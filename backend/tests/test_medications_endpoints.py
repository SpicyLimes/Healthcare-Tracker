from app.models.user import Role
from app.services import user_service


def _admin_login(client, db_session):
    user_service.create_user(db_session, "admin@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "admin@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def _viewer_login(client, db_session):
    user_service.create_user(db_session, "viewer@example.com", "a-strong-passphrase-123", Role.viewer)
    client.post("/api/auth/login", json={"email": "viewer@example.com", "password": "a-strong-passphrase-123"})


def test_admin_create_list_get_update_delete(client, db_session):
    csrf = _admin_login(client, db_session)
    created = client.post("/api/medications", headers={"X-CSRF-Token": csrf},
                          json={"name": "Aspirin", "dose": "81mg"})
    assert created.status_code == 201
    med_id = created.json()["id"]
    assert created.json()["kind"] == "medication"

    listing = client.get("/api/medications")
    assert listing.status_code == 200
    assert any(m["id"] == med_id for m in listing.json())

    one = client.get(f"/api/medications/{med_id}")
    assert one.status_code == 200
    assert one.json()["name"] == "Aspirin"

    updated = client.put(f"/api/medications/{med_id}", headers={"X-CSRF-Token": csrf},
                         json={"dose": "162mg", "is_active": False})
    assert updated.status_code == 200
    assert updated.json()["dose"] == "162mg"
    assert updated.json()["is_active"] is False

    deleted = client.delete(f"/api/medications/{med_id}", headers={"X-CSRF-Token": csrf})
    assert deleted.status_code == 204
    assert client.get(f"/api/medications/{med_id}").status_code == 404


def test_viewer_can_read_but_not_write(client, db_session):
    csrf = _admin_login(client, db_session)
    client.post("/api/medications", headers={"X-CSRF-Token": csrf}, json={"name": "Aspirin"})
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})

    _viewer_login(client, db_session)
    assert client.get("/api/medications").status_code == 200
    blocked = client.post("/api/medications", json={"name": "Sneaky"})
    assert blocked.status_code == 403


def test_write_requires_csrf(client, db_session):
    _admin_login(client, db_session)
    resp = client.post("/api/medications", json={"name": "NoCsrf"})
    assert resp.status_code == 403


def test_read_requires_auth(client, db_session):
    assert client.get("/api/medications").status_code == 401


def test_update_missing_returns_404(client, db_session):
    csrf = _admin_login(client, db_session)
    import uuid
    resp = client.put(f"/api/medications/{uuid.uuid4()}", headers={"X-CSRF-Token": csrf},
                      json={"dose": "1mg"})
    assert resp.status_code == 404


def test_create_validation_error_422(client, db_session):
    csrf = _admin_login(client, db_session)
    resp = client.post("/api/medications", headers={"X-CSRF-Token": csrf}, json={"dose": "no name"})
    assert resp.status_code == 422
