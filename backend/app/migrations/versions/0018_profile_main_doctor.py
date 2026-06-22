"""Add main_doctor_id to profile

Revision ID: 0018
Revises: 0017
Create Date: 2026-06-22
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "profile",
        sa.Column(
            "main_doctor_id",
            UUID(as_uuid=True),
            sa.ForeignKey("doctors.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("profile", "main_doctor_id")
