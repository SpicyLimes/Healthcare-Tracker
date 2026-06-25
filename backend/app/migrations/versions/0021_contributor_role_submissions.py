"""Add contributor role and submissions table

Revision ID: 0021
Revises: 0020
Create Date: 2026-06-23
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import UUID

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Postgres 12+ (this project runs PG 17) allows ALTER TYPE ... ADD VALUE
    # inside a transaction, so we stay inside Alembic's transaction — no manual
    # COMMIT/BEGIN.  (The previous COMMIT/BEGIN approach desynced SQLAlchemy's
    # transaction state, which silently defeated create_type=False and caused a
    # duplicate CREATE TYPE for the submission enums.)
    #
    # We only ADD the enum value; we never USE it (no INSERT/UPDATE referencing
    # 'contributor') in this same transaction — the one thing Postgres forbids.
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'contributor' AFTER 'admin'")

    bind = op.get_bind()

    # Create the submission enum types explicitly with checkfirst=True so this
    # migration is safe to re-run even if a prior failed attempt left the types
    # behind.  We reuse the SAME ENUM instances as the column types with
    # create_type=False so create_table does not try to create them again.
    submission_action = postgresql.ENUM(
        "create", "update", "delete", name="submissionaction", create_type=False
    )
    submission_status = postgresql.ENUM(
        "pending", "approved", "rejected", name="submissionstatus", create_type=False
    )
    submission_action.create(bind, checkfirst=True)
    submission_status.create(bind, checkfirst=True)

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
        sa.Column("action", submission_action, nullable=False),
        sa.Column("record_id", sa.String(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column(
            "status",
            submission_status,
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

    # Add new audit actions (ADD VALUE is transaction-safe on PG 12+).
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
