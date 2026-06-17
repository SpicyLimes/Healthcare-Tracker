"""Add vitals table and visit_logs.linked_vitals_id

Revision ID: 0017
Revises: 0016
Create Date: 2026-06-17
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "vitals",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("measured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("bp_systolic", sa.Integer(), nullable=True),
        sa.Column("bp_diastolic", sa.Integer(), nullable=True),
        sa.Column("pulse_bpm", sa.Integer(), nullable=True),
        sa.Column("height_in", sa.Numeric(5, 1), nullable=True),
        sa.Column("weight_lb", sa.Numeric(6, 1), nullable=True),
        sa.Column("temperature_f", sa.Numeric(4, 1), nullable=True),
        sa.Column("respiratory_rate", sa.Integer(), nullable=True),
        sa.Column("spo2", sa.Integer(), nullable=True),
        sa.Column("blood_glucose", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("visit_log_id", UUID(as_uuid=True), sa.ForeignKey("visit_logs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.add_column("visit_logs", sa.Column("linked_vitals_id", UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_visit_logs_linked_vitals_id",
        "visit_logs", "vitals",
        ["linked_vitals_id"], ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_visit_logs_linked_vitals_id", "visit_logs", type_="foreignkey")
    op.drop_column("visit_logs", "linked_vitals_id")
    op.drop_table("vitals")
