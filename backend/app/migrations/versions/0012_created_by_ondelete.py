"""Add ondelete=SET NULL to all created_by FKs; allow NULL in those columns

Revision ID: 0012
Revises: 0011
Create Date: 2026-06-08
"""
import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None

_TABLES = [
    ("profile",           "created_by"),
    ("doctors",           "created_by"),
    ("ailments",          "created_by"),
    ("medications",       "created_by"),
    ("notes",             "author_user_id"),
    ("insurances",        "created_by"),
    ("pharmacies",        "created_by"),
    ("family_history",    "created_by"),
    ("surgeries",         "created_by"),
    ("hospitalizations",  "created_by"),
    ("vision_history",    "created_by"),
    ("dental_history",    "created_by"),
    ("vaccinations",      "created_by"),
    ("visit_logs",        "created_by"),
    ("appointments",      "created_by"),
]


def upgrade() -> None:
    for table, col in _TABLES:
        fk_name = f"{table}_{col}_fkey"
        op.alter_column(table, col, nullable=True)
        op.drop_constraint(fk_name, table, type_="foreignkey")
        op.create_foreign_key(
            fk_name, table, "users", [col], ["id"], ondelete="SET NULL"
        )


def downgrade() -> None:
    for table, col in _TABLES:
        fk_name = f"{table}_{col}_fkey"
        op.drop_constraint(fk_name, table, type_="foreignkey")
        op.create_foreign_key(fk_name, table, "users", [col], ["id"])
