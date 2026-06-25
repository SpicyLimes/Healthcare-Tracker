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
    # All three ALTER TYPE / CREATE TYPE calls need to run outside a transaction
    # on Postgres ≤ 11.  We use COMMIT/BEGIN to bracket the whole block.
    op.execute("COMMIT")
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'contributor' AFTER 'admin'")

    # Check if enum types exist before creating them (psycopg3 doesn't handle DO $$ blocks properly)
    conn = op.get_bind()
    if not conn.execute(sa.text("SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = 'submissionaction')")).scalar():
        conn.execute(sa.text("CREATE TYPE submissionaction AS ENUM ('create', 'update', 'delete')"))
    if not conn.execute(sa.text("SELECT EXISTS(SELECT 1 FROM pg_type WHERE typname = 'submissionstatus')")).scalar():
        conn.execute(sa.text("CREATE TYPE submissionstatus AS ENUM ('pending', 'approved', 'rejected')"))

    op.execute("BEGIN")

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
        sa.Column("action", sa.Enum("create", "update", "delete", name="submissionaction", create_type=False), nullable=False),
        sa.Column("record_id", sa.String(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "approved", "rejected", name="submissionstatus", create_type=False),
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
