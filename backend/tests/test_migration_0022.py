"""Smoke-test that the submission_withdrawn audit enum value is present."""
from sqlalchemy import text


def test_migration_0022_adds_submission_withdrawn(db_session):
    # The test DB enum is built from the model; assert the new value is present.
    rows = db_session.execute(
        text(
            "SELECT enumlabel FROM pg_enum e "
            "JOIN pg_type t ON e.enumtypid = t.oid "
            "WHERE t.typname = 'auditaction'"
        )
    ).scalars().all()
    assert "submission_withdrawn" in rows
