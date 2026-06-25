"""Smoke-test that the 0021 migration artifacts exist after create_all."""
from sqlalchemy import inspect, text

# Ensure the Submission model is registered with Base.metadata before create_all.
import app.models.submission  # noqa: F401


def test_submissions_table_exists(engine):
    insp = inspect(engine)
    assert "submissions" in insp.get_table_names()


def test_submissions_columns(engine):
    insp = inspect(engine)
    cols = {c["name"] for c in insp.get_columns("submissions")}
    expected = {
        "id", "submitted_by", "section", "action",
        "record_id", "payload", "status",
        "reviewed_by", "reviewed_at", "reject_reason", "created_at",
    }
    assert expected.issubset(cols)


def test_contributor_role_accepted(engine):
    with engine.connect() as conn:
        conn.execute(
            text("SELECT 'contributor'::user_role")
        )
