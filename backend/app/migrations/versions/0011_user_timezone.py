"""add timezone to users

Revision ID: 0011
Revises: 0010
Create Date: 2026-06-08
"""
import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("timezone", sa.String(64), nullable=False, server_default="America/Chicago"),
    )


def downgrade() -> None:
    op.drop_column("users", "timezone")
