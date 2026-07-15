"""Add pharmacy_id to medications

Revision ID: 0028
Revises: 0027
Create Date: 2026-07-14
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "medications",
        sa.Column(
            "pharmacy_id",
            UUID(as_uuid=True),
            sa.ForeignKey("pharmacies.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("medications", "pharmacy_id")
