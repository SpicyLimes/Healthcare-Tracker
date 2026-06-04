# backend/app/migrations/versions/0004_documents.py
"""documents table

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-04

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "CREATE TYPE documentsection AS ENUM ("
        "'surgeries','hospitalizations','vision_history','dental_history',"
        "'visit_logs','appointments','medications','vaccinations',"
        "'insurances','ailments','doctors','profile')"
    )
    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("stored_filename", sa.String(), nullable=False),
        sa.Column(
            "section",
            postgresql.ENUM(
                "surgeries", "hospitalizations", "vision_history", "dental_history",
                "visit_logs", "appointments", "medications", "vaccinations",
                "insurances", "ailments", "doctors", "profile",
                name="documentsection",
                create_type=False,
            ),
            nullable=False,
        ),
        sa.Column("record_id", sa.String(), nullable=True),
        sa.Column("mime_type", sa.String(), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"], ondelete="SET NULL"),
    )


def downgrade() -> None:
    op.drop_table("documents")
    op.execute("DROP TYPE IF EXISTS documentsection")
