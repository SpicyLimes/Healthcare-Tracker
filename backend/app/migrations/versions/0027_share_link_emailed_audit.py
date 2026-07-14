"""Add share_link_emailed audit action

Revision ID: 0027
Revises: 0026
Create Date: 2026-06-26

Note: originally authored as 0023 (off 0022); renumbered to 0027 when the
Backups feature landed on main as 0026. 0023-0025 stay unused unless the
tabled 2FA branch reclaims them.
"""
from alembic import op

revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PG 12+ allows ALTER TYPE ... ADD VALUE inside a transaction, and the new
    # value is NOT used in this same transaction (the one Postgres restriction).
    # IF NOT EXISTS makes it idempotent on a fresh or already-deployed DB.
    op.execute("ALTER TYPE auditaction ADD VALUE IF NOT EXISTS 'share_link_emailed'")


def downgrade() -> None:
    # Postgres does not support removing enum values. The value remains after
    # downgrade (safe — no rows reference it on downgrade).
    pass
