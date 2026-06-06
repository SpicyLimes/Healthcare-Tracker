"""add height/weight/phone to profile, route to medications, manufacturer to vaccinations, appointment_type to appointments

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-05
"""
import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Profile
    op.add_column("profile", sa.Column("height", sa.String(), nullable=True))
    op.add_column("profile", sa.Column("weight", sa.String(), nullable=True))
    op.add_column("profile", sa.Column("phone", sa.String(), nullable=True))

    # Medications
    op.add_column("medications", sa.Column("route", sa.String(), nullable=True))

    # Vaccinations
    op.add_column("vaccinations", sa.Column("manufacturer", sa.String(), nullable=True))

    # Appointments — add enum type first, then column
    appointment_type = sa.Enum(
        "annual_checkup", "follow_up", "specialist", "lab", "imaging",
        "dental", "vision", "other",
        name="appointment_type",
    )
    appointment_type.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "appointments",
        sa.Column(
            "appointment_type",
            sa.Enum(
                "annual_checkup", "follow_up", "specialist", "lab", "imaging",
                "dental", "vision", "other",
                name="appointment_type",
            ),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("appointments", "appointment_type")
    op.execute("DROP TYPE IF EXISTS appointment_type")
    op.drop_column("vaccinations", "manufacturer")
    op.drop_column("medications", "route")
    op.drop_column("profile", "phone")
    op.drop_column("profile", "weight")
    op.drop_column("profile", "height")
