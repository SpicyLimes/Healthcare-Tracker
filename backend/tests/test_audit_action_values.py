from app.models.audit_log import AuditAction


def test_auth_and_user_management_actions_exist():
    assert AuditAction.login.value == "login"
    assert AuditAction.logout.value == "logout"
    assert AuditAction.login_failed.value == "login_failed"
    assert AuditAction.password_change.value == "password_change"
    assert AuditAction.password_reset.value == "password_reset"
    assert AuditAction.user_created.value == "user_created"
    assert AuditAction.user_updated.value == "user_updated"
    assert AuditAction.user_deactivated.value == "user_deactivated"
    assert AuditAction.user_reactivated.value == "user_reactivated"
    assert AuditAction.user_deleted.value == "user_deleted"


from app.models.audit_log import AuditLog
from app.models.user import Role
from app.services import user_service


def _last_action_for(db_session, needle: str):
    row = (
        db_session.query(AuditLog)
        .filter(AuditLog.detail.contains(needle))
        .order_by(AuditLog.id.desc())
        .first()
    )
    return row.action if row else None


def test_login_logout_password_actions(client, db_session):
    user_service.create_user(db_session, "carol@example.com", "a-strong-passphrase-123", Role.viewer)
    client.post("/api/auth/login", json={"email": "carol@example.com", "password": "a-strong-passphrase-123"})
    assert _last_action_for(db_session, "User logged in: carol@example.com") == AuditAction.login

    csrf = client.cookies.get("csrf_token")
    client.put("/api/auth/password", headers={"X-CSRF-Token": csrf},
               json={"current_password": "a-strong-passphrase-123", "new_password": "another-strong-passphrase-456"})
    assert _last_action_for(db_session, "Password changed: carol@example.com") == AuditAction.password_change

    csrf = client.cookies.get("csrf_token")
    client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf})
    assert _last_action_for(db_session, "User logged out: carol@example.com") == AuditAction.logout


def _admin_csrf(client, db_session):
    user_service.create_user(db_session, "boss@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "boss@example.com", "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def test_user_management_actions(client, db_session):
    csrf = _admin_csrf(client, db_session)

    resp = client.post("/api/users", headers={"X-CSRF-Token": csrf},
                       json={"email": "m@example.com", "password": "a-strong-passphrase-123", "role": "viewer"})
    uid = resp.json()["id"]
    assert _last_action_for(db_session, "Admin created user: m@example.com") == AuditAction.user_created

    client.put(f"/api/users/{uid}", headers={"X-CSRF-Token": csrf},
               json={"role": "contributor"})
    assert _last_action_for(db_session, "Admin updated user: m@example.com") == AuditAction.user_updated

    client.put(f"/api/users/{uid}", headers={"X-CSRF-Token": csrf},
               json={"is_active": False})
    assert _last_action_for(db_session, "Admin updated user: m@example.com") == AuditAction.user_deactivated

    client.put(f"/api/users/{uid}", headers={"X-CSRF-Token": csrf},
               json={"is_active": True})
    assert _last_action_for(db_session, "Admin updated user: m@example.com") == AuditAction.user_reactivated

    client.delete(f"/api/users/{uid}", headers={"X-CSRF-Token": csrf})
    assert _last_action_for(db_session, "Admin deleted user: m@example.com") == AuditAction.user_deleted


def test_password_reset_actions(client, db_session, monkeypatch):
    from tests.test_temp_password import RecordingSender
    monkeypatch.setattr("app.routers.users.get_email_sender", lambda: RecordingSender())
    csrf = _admin_csrf(client, db_session)
    resp = client.post("/api/users", headers={"X-CSRF-Token": csrf},
                       json={"email": "r@example.com", "password": "a-strong-passphrase-123", "role": "viewer"})
    uid = resp.json()["id"]

    client.post(f"/api/users/{uid}/reset-password", headers={"X-CSRF-Token": csrf},
                json={"expires_minutes": 60})
    assert _last_action_for(db_session, "Admin emailed temporary password to user: r@example.com") == AuditAction.password_reset

    client.put(f"/api/users/{uid}/password", headers={"X-CSRF-Token": csrf},
               json={"new_password": "yet-another-passphrase-789"})
    assert _last_action_for(db_session, "Admin reset password for user: r@example.com") == AuditAction.password_reset
