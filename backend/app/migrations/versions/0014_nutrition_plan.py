# backend/app/migrations/versions/0014_nutrition_plan.py
"""Add nutrition plan tables and nutrition_plan DocumentSection value

Revision ID: 0014
Revises: 0013
Create Date: 2026-06-09
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add nutrition_plan to the existing documentsection enum
    op.execute("ALTER TYPE documentsection ADD VALUE IF NOT EXISTS 'nutrition_plan'")

    # Create mealtype enum
    op.execute(
        "CREATE TYPE mealtype AS ENUM ('breakfast', 'lunch', 'dinner', 'snacks')"
    )

    op.create_table(
        "nutrition_meals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "meal_type",
            postgresql.ENUM("breakfast", "lunch", "dinner", "snacks", name="mealtype", create_type=False),
            nullable=False,
        ),
        sa.Column("food_name", sa.String(), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
    )

    op.create_table(
        "nutrition_acceptable_foods",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("food_name", sa.String(), nullable=False),
        sa.Column("for_breakfast", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("for_lunch", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("for_dinner", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("for_snacks", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
    )

    op.create_table(
        "nutrition_unacceptable_foods",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("food_name", sa.String(), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
    )


def downgrade() -> None:
    op.drop_table("nutrition_unacceptable_foods")
    op.drop_table("nutrition_acceptable_foods")
    op.drop_table("nutrition_meals")
    op.execute("DROP TYPE IF EXISTS mealtype")
    # Note: PostgreSQL does not support removing enum values; nutrition_plan stays in documentsection
