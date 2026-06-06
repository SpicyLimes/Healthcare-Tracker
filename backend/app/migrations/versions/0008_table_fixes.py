"""add follow_up_date to visit_logs, prescribing_doctor_id to medications, treating_doctor_id to ailments

Revision ID: 0008
Revises: 0007
Create Date: 2026-06-06
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("visit_logs", sa.Column("follow_up_date", sa.Date(), nullable=True))
    op.add_column(
        "medications",
        sa.Column(
            "prescribing_doctor_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_medications_prescribing_doctor_id",
        "medications",
        "doctors",
        ["prescribing_doctor_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "ailments",
        sa.Column(
            "treating_doctor_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_ailments_treating_doctor_id",
        "ailments",
        "doctors",
        ["treating_doctor_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_ailments_treating_doctor_id", "ailments", type_="foreignkey")
    op.drop_column("ailments", "treating_doctor_id")
    op.drop_constraint("fk_medications_prescribing_doctor_id", "medications", type_="foreignkey")
    op.drop_column("medications", "prescribing_doctor_id")
    op.drop_column("visit_logs", "follow_up_date")
