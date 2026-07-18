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
    # PG 12+ allows ALTER TYPE ... ADD VALUE inside a transaction; the new
    # values may not be USED until commit, which is why the backfill lives
    # in migration 0032, not here.
    for value in _NEW_VALUES:
        op.execute(f"ALTER TYPE auditaction ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    # Postgres cannot drop enum values; leftover values are harmless.
    pass
