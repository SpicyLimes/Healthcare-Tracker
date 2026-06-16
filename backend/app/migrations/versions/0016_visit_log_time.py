# backend/app/migrations/versions/0016_visit_log_time.py
"""Add visit_time column to visit_logs

Revision ID: 0016
Revises: 0015
Create Date: 2026-06-15
"""
import sqlalchemy as sa
from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("visit_logs", sa.Column("visit_time", sa.Time(), nullable=True))


def downgrade() -> None:
    op.drop_column("visit_logs", "visit_time")
