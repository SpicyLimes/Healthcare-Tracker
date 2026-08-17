"""Add used_for to medications

The reason a medication is taken had no home of its own, so it was written into
`notes` — which guests and the printout never render. A family member asking
"what is this one for?" therefore could not be answered from a share link.

Additive and nullable: existing notes are left exactly as written, and this
column starts empty on every row. Nothing is parsed out of `notes`.

Revision ID: 0037
Revises: 0036
Create Date: 2026-08-17
"""
import sqlalchemy as sa
from alembic import op

revision = "0037"
down_revision = "0036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("medications", sa.Column("used_for", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("medications", "used_for")
