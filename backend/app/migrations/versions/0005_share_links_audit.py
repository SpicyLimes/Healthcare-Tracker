# backend/app/migrations/versions/0005_share_links_audit.py
"""share_links and audit_log tables

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-04

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE TYPE auditaction AS ENUM ('create','update','delete','share_link_access')")
    op.execute("CREATE TYPE actortype AS ENUM ('user','guest')")

    op.create_table(
        "share_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("label", sa.String(), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False, unique=True, index=True),
        sa.Column("allowed_sections", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
    )

    op.create_table(
        "audit_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "action",
            postgresql.ENUM("create", "update", "delete", "share_link_access",
                            name="auditaction", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "actor_type",
            postgresql.ENUM("user", "guest", name="actortype", create_type=False),
            nullable=False,
        ),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_share_link_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("section", sa.String(), nullable=True),
        sa.Column("record_id", sa.String(), nullable=True),
        sa.Column("detail", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["actor_share_link_id"], ["share_links.id"], ondelete="SET NULL"),
    )


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("share_links")
    op.execute("DROP TYPE IF EXISTS auditaction")
    op.execute("DROP TYPE IF EXISTS actortype")
