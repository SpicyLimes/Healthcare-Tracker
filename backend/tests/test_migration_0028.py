"""Smoke-test that medications.pharmacy_id exists and is nullable."""
from sqlalchemy import text


def test_medications_pharmacy_id_column(db_session):
    row = db_session.execute(
        text(
            "SELECT is_nullable FROM information_schema.columns "
            "WHERE table_name = 'medications' AND column_name = 'pharmacy_id'"
        )
    ).first()
    assert row is not None
    assert row.is_nullable == "YES"
