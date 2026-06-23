"""Add missing FK indexes on appointments.visit_log_id and vitals.visit_log_id

Revision ID: 0020
Revises: 0019
Create Date: 2026-06-22
"""
from alembic import op

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Used in subquery on every calendar load and every guest visit_logs load
    op.create_index("ix_appointments_visit_log_id", "appointments", ["visit_log_id"])
    # Used in circular FK cross-check and future joins
    op.create_index("ix_vitals_visit_log_id", "vitals", ["visit_log_id"])


def downgrade() -> None:
    op.drop_index("ix_vitals_visit_log_id", table_name="vitals")
    op.drop_index("ix_appointments_visit_log_id", table_name="appointments")
