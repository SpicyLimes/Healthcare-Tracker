# backend/app/migrations/versions/0015_ai_settings.py
"""Add ai_settings table and ai_query AuditAction value

Revision ID: 0015
Revises: 0014
Create Date: 2026-06-10
"""
import sqlalchemy as sa
from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE auditaction ADD VALUE IF NOT EXISTS 'ai_query'")

    op.create_table(
        "ai_settings",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("base_url", sa.String(), nullable=True),
        sa.Column("model", sa.String(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("id = 1", name="ai_settings_singleton"),
    )


def downgrade() -> None:
    op.drop_table("ai_settings")
    # Note: Postgres cannot DROP a single enum value; 'ai_query' remains after downgrade.
