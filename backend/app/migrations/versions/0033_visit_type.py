"""Add visit_type to visit_logs

Revision ID: 0033
Revises: 0032
Create Date: 2026-07-19
"""
import sqlalchemy as sa
from alembic import op

revision = "0033"
down_revision = "0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "visit_logs",
        sa.Column("visit_type", sa.String(), nullable=False, server_default="in_person"),
    )


def downgrade() -> None:
    op.drop_column("visit_logs", "visit_type")
