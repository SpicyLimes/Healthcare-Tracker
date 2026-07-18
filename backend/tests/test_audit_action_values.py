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
