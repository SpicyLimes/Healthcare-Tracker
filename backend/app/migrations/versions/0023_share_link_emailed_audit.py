"""Add share_link_emailed audit action

Revision ID: 0023
Revises: 0022
Create Date: 2026-06-26
"""
from alembic import op

revision = "0023"
down_revision = "0022"
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
