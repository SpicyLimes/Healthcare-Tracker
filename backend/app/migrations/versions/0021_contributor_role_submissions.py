"""Add contributor role and submissions table

Revision ID: 0021
Revises: 0020
Create Date: 2026-06-23
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add contributor to the user_role enum.
    # ALTER TYPE … ADD VALUE cannot run inside a transaction in Postgres ≤ 11.
    op.execute("COMMIT")
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'contributor' AFTER 'admin'")
    op.execute("BEGIN")

    # New enums for submissions
    submissionaction = sa.Enum(
        "create", "update", "delete", name="submissionaction"
    )
    submissionstatus = sa.Enum(
        "pending", "approved", "rejected", name="submissionstatus"
    )
    submissionaction.create(op.get_bind(), checkfirst=True)
    submissionstatus.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "submissions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "submitted_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("section", sa.String(), nullable=False),
        sa.Column("action", sa.Enum("create", "update", "delete", name="submissionaction"), nullable=False),
        sa.Column("record_id", sa.String(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "approved", "rejected", name="submissionstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "reviewed_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reject_reason", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_submissions_status", "submissions", ["status"])
    op.create_index("ix_submissions_section", "submissions", ["section"])

    # Add new audit actions
    op.execute("ALTER TYPE auditaction ADD VALUE IF NOT EXISTS 'submission_created'")
    op.execute("ALTER TYPE auditaction ADD VALUE IF NOT EXISTS 'submission_approved'")
    op.execute("ALTER TYPE auditaction ADD VALUE IF NOT EXISTS 'submission_rejected'")


def downgrade() -> None:
    op.drop_index("ix_submissions_section", "submissions")
    op.drop_index("ix_submissions_status", "submissions")
    op.drop_table("submissions")
    op.execute("DROP TYPE IF EXISTS submissionstatus")
    op.execute("DROP TYPE IF EXISTS submissionaction")
    # Note: Postgres does not support removing enum values.
    # 'contributor' remains in user_role after downgrade (safe — no rows will have it).
