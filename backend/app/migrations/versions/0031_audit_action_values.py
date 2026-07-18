"""Add auth + user-management audit action enum values

Revision ID: 0031
Revises: 0030
Create Date: 2026-07-18
"""
from alembic import op

revision = "0031"
down_revision = "0030"
branch_labels = None
depends_on = None

_NEW_VALUES = (
    "login", "logout", "login_failed", "password_change", "password_reset",
    "user_created", "user_updated", "user_deactivated", "user_reactivated",
    "user_deleted",
)


def upgrade() -> None:
    # A single `alembic upgrade head` run executes 0031 and 0032 in one
    # transaction (env.py has no transaction_per_migration). Postgres raises
    # UnsafeNewEnumValueUsage if a newly added enum value is used before the
    # adding transaction commits, so we wrap the ADD VALUE statements in their
    # own autocommit_block to commit them before 0032's backfill runs.
    with op.get_context().autocommit_block():
        for value in _NEW_VALUES:
            op.execute(f"ALTER TYPE auditaction ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    # Postgres cannot drop enum values; leftover values are harmless.
    pass
