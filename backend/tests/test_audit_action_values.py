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
