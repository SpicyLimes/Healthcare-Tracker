import re

from app.models.user import Role
from app.security.passwords import MIN_PASSWORD_LENGTH, generate_temp_password, validate_password_policy
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


TEMP_FORMAT = re.compile(r"^[A-Z][a-z]{3,5}-[A-Z][a-z]{3,5}-\d{4}!$")


def test_generate_temp_password_format():
    for _ in range(50):
        pw = generate_temp_password()
        assert TEMP_FORMAT.match(pw), pw
        assert len(pw) >= MIN_PASSWORD_LENGTH
        validate_password_policy(pw)  # must not raise


def test_generate_temp_password_varies():
    assert len({generate_temp_password() for _ in range(50)}) > 40
