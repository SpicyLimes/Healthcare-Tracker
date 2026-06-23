"""Add visit_log_id to appointments

Revision ID: 0019
Revises: 0018
Create Date: 2026-06-22
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "appointments",
        sa.Column(
            "visit_log_id",
            UUID(as_uuid=True),
            sa.ForeignKey("visit_logs.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("appointments", "visit_log_id")
