from app.models.user import Role
from app.services import user_service


def _admin_login(client, db_session):
    user_service.create_user(db_session, "admin@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "admin@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def test_new_user_defaults_no_temp_password_state(client, db_session):
    user = user_service.create_user(db_session, "u@example.com", "a-strong-passphrase-123", Role.viewer)
    assert user.must_change_password is False
    assert user.temp_password_expires_at is None


def test_me_and_user_list_expose_temp_password_fields(client, db_session):
    csrf = _admin_login(client, db_session)
    me = client.get("/api/auth/me").json()
    assert me["must_change_password"] is False
    listing = client.get("/api/users").json()
    assert listing[0]["must_change_password"] is False
    assert listing[0]["temp_password_expires_at"] is None
