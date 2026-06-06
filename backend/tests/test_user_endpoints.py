from app.models.user import Role
from app.services import user_service


def _admin_login(client, db_session):
    user_service.create_user(db_session, "admin@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "admin@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def test_admin_can_create_and_list_users(client, db_session):
    csrf = _admin_login(client, db_session)
    create = client.post("/api/users", headers={"X-CSRF-Token": csrf},
                         json={"email": "carol@example.com", "password": "a-strong-passphrase-123", "role": "viewer"})
    assert create.status_code == 201
    listing = client.get("/api/users")
    assert listing.status_code == 200
    emails = [u["email"] for u in listing.json()]
    assert "carol@example.com" in emails and "admin@example.com" in emails


def test_create_user_weak_password_rejected(client, db_session):
    csrf = _admin_login(client, db_session)
    resp = client.post("/api/users", headers={"X-CSRF-Token": csrf},
                       json={"email": "x@example.com", "password": "short", "role": "viewer"})
    assert resp.status_code == 422 or resp.status_code == 400


def test_admin_can_reset_user_password(client, db_session):
    csrf = _admin_login(client, db_session)
    carol = user_service.create_user(db_session, "carol@example.com", "a-strong-passphrase-123", Role.viewer)
    resp = client.put(f"/api/users/{carol.id}/password", headers={"X-CSRF-Token": csrf},
                      json={"new_password": "reset-strong-passphrase-789"})
    assert resp.status_code == 204


def test_cannot_delete_last_admin(client, db_session):
    csrf = _admin_login(client, db_session)
    me = client.get("/api/auth/me").json()
    resp = client.delete(f"/api/users/{me['id']}", headers={"X-CSRF-Token": csrf})
    assert resp.status_code == 409


def test_viewer_is_blocked_from_user_management(client, db_session):
    user_service.create_user(db_session, "carol@example.com", "a-strong-passphrase-123", Role.viewer)
    client.post("/api/auth/login", json={"email": "carol@example.com", "password": "a-strong-passphrase-123"})
    resp = client.get("/api/users")
    assert resp.status_code == 403


def test_user_management_requires_authentication(client, db_session):
    resp = client.get("/api/users")
    assert resp.status_code == 401


def test_admin_can_set_full_name(client, db_session):
    csrf = _admin_login(client, db_session)
    carol = user_service.create_user(db_session, "carol@example.com", "a-strong-passphrase-123", Role.viewer)
    resp = client.put(
        f"/api/users/{carol.id}",
        headers={"X-CSRF-Token": csrf},
        json={"full_name": "Carol Smith"},
    )
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Carol Smith"


def test_admin_can_clear_full_name(client, db_session):
    csrf = _admin_login(client, db_session)
    carol = user_service.create_user(db_session, "carol@example.com", "a-strong-passphrase-123", Role.viewer)
    carol.full_name = "Carol Smith"
    db_session.flush()
    resp = client.put(
        f"/api/users/{carol.id}",
        headers={"X-CSRF-Token": csrf},
        json={"full_name": ""},
    )
    assert resp.status_code == 200
    assert resp.json()["full_name"] is None


def test_update_without_full_name_leaves_name_unchanged(client, db_session):
    csrf = _admin_login(client, db_session)
    carol = user_service.create_user(db_session, "carol@example.com", "a-strong-passphrase-123", Role.viewer)
    carol.full_name = "Carol Smith"
    db_session.flush()
    resp = client.put(
        f"/api/users/{carol.id}",
        headers={"X-CSRF-Token": csrf},
        json={"role": "viewer"},
    )
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Carol Smith"
