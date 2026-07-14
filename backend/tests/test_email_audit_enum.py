from app.models.audit_log import AuditAction


def test_share_link_emailed_action_exists():
    assert AuditAction.share_link_emailed.value == "share_link_emailed"
