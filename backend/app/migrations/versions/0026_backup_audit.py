"""Add backup_* audit actions for the admin Backups page

Revision ID: 0026
Revises: 0022
Create Date: 2026-07-13

Note: numbered 0026 because 0023-0025 are reserved by the email/2FA
integration branch; down_revision intentionally remains 0022 (main's head).
"""
from alembic import op

revision = "0026"
down_revision = "0022"
branch_labels = None
depends_on = None

_VALUES = ("backup_create", "backup_download", "backup_upload", "backup_restore", "backup_delete")


def upgrade() -> None:
    # PG 12+ allows ALTER TYPE ... ADD VALUE inside a transaction as long as
    # the value isn't used in the same transaction. IF NOT EXISTS keeps this
    # idempotent on an already-deployed or partial DB.
    for value in _VALUES:
        op.execute(f"ALTER TYPE auditaction ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    # Postgres does not support removing enum values. Safe to leave in place.
    pass
