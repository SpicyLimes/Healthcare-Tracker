"""Smoke-test that the backup_* audit enum values are present."""
from sqlalchemy import text

BACKUP_ACTIONS = {"backup_create", "backup_download", "backup_upload", "backup_restore", "backup_delete"}


def test_migration_0026_adds_backup_actions(db_session):
    # The test DB enum is built from the model; assert the new values are present.
    rows = db_session.execute(
        text(
            "SELECT enumlabel FROM pg_enum e "
            "JOIN pg_type t ON e.enumtypid = t.oid "
            "WHERE t.typname = 'auditaction'"
        )
    ).scalars().all()
    assert BACKUP_ACTIONS <= set(rows)
