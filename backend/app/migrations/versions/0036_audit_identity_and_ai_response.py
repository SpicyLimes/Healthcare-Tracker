"""Add attempted_identity and ai_response to audit_log

Two independent nullable columns, both additive:

* attempted_identity — the email a failed login was tried as. Failed logins
  carry no actor_user_id (the address frequently matches no user at all), so
  the Audit Log rendered every one of them as actor "unknown".
* ai_response — the assistant's answer, so the log holds both halves of an AI
  exchange instead of only the question.

Plain ADD COLUMN, unlike 0031 which added enum VALUEs and needed an
autocommit_block. Existing rows get NULL for both.

Revision ID: 0036
Revises: 0035
Create Date: 2026-08-17
"""
import sqlalchemy as sa
from alembic import op

revision = "0036"
down_revision = "0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("audit_log", sa.Column("attempted_identity", sa.String(), nullable=True))
    op.add_column("audit_log", sa.Column("ai_response", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("audit_log", "ai_response")
    op.drop_column("audit_log", "attempted_identity")
