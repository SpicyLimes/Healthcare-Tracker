"""Add submission_withdrawn audit action

Revision ID: 0022
Revises: 0021
Create Date: 2026-06-25
"""
from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PG 12+ allows ALTER TYPE ... ADD VALUE inside a transaction, and the new
    # value is not USED in this same transaction (the one Postgres restriction).
    # IF NOT EXISTS makes it idempotent on an already-deployed or partial DB.
    op.execute("ALTER TYPE auditaction ADD VALUE IF NOT EXISTS 'submission_withdrawn'")


def downgrade() -> None:
    # Postgres does not support removing enum values. The value remains after
    # downgrade (safe — no rows reference it on downgrade).
    pass
