"""Backfill historical audit rows to the specific auth/user actions

Revision ID: 0032
Revises: 0031
Create Date: 2026-07-18
"""
from alembic import op

revision = "0032"
down_revision = "0031"
branch_labels = None
depends_on = None

# (old action, detail prefix, new action) — prefixes are machine-generated
# by our own log_event call sites and stable across the app's history.
_MAPPINGS = (
    ("create", "User logged in:", "login"),
    ("delete", "User logged out:", "logout"),
    ("create", "Failed login attempt:", "login_failed"),
    ("create", "Login refused (temporary password expired):", "login_failed"),
    ("update", "Password changed:", "password_change"),
    ("update", "Admin reset password for user:", "password_reset"),
    ("update", "Admin emailed temporary password to user:", "password_reset"),
    ("create", "Admin created user:", "user_created"),
    ("update", "Admin updated user:", "user_updated"),
    ("delete", "Admin deleted user:", "user_deleted"),
)


def upgrade() -> None:
    for old, prefix, new in _MAPPINGS:
        op.execute(
            "UPDATE audit_log SET action = '{new}' "
            "WHERE action = '{old}' AND detail LIKE '{prefix}%'".format(
                new=new, old=old, prefix=prefix.replace("'", "''")
            )
        )


def downgrade() -> None:
    for old, prefix, new in _MAPPINGS:
        op.execute(
            "UPDATE audit_log SET action = '{old}' "
            "WHERE action = '{new}' AND detail LIKE '{prefix}%'".format(
                new=new, old=old, prefix=prefix.replace("'", "''")
            )
        )
