"""Add procedure_type to surgeries

Revision ID: 0034
Revises: 0033
Create Date: 2026-07-19
"""
import sqlalchemy as sa
from alembic import op

revision = "0034"
down_revision = "0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "surgeries",
        sa.Column("procedure_type", sa.String(), nullable=False, server_default="surgery"),
    )


def downgrade() -> None:
    op.drop_column("surgeries", "procedure_type")
