"""extended records: insurances, pharmacies, family_history, surgeries,
   hospitalizations, vision_history, dental_history, vaccinations, visit_logs,
   appointments

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-04

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def _common_columns():
    return [
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
    ]


def upgrade() -> None:
    op.create_table(
        "insurances",
        sa.Column("insurer_name", sa.String(), nullable=False),
        sa.Column("policy_number", sa.String(), nullable=True),
        sa.Column("group_number", sa.String(), nullable=True),
        sa.Column("contact_phone", sa.String(), nullable=True),
        sa.Column("contact_address", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        *_common_columns(),
    )

    op.create_table(
        "pharmacies",
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("fax", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        *_common_columns(),
    )

    op.create_table(
        "family_history",
        sa.Column("relative", sa.String(), nullable=False),
        sa.Column("condition", sa.String(), nullable=False),
        sa.Column("age_of_onset", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        *_common_columns(),
    )

    op.create_table(
        "surgeries",
        sa.Column("procedure", sa.String(), nullable=False),
        sa.Column("surgery_date", sa.Date(), nullable=True),
        sa.Column("surgeon_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("surgeon_other", sa.String(), nullable=True),
        sa.Column("hospital", sa.String(), nullable=True),
        sa.Column("outcome", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["surgeon_id"], ["doctors.id"], ondelete="SET NULL"),
        *_common_columns(),
    )

    op.create_table(
        "hospitalizations",
        sa.Column("facility", sa.String(), nullable=False),
        sa.Column("admission_date", sa.Date(), nullable=True),
        sa.Column("discharge_date", sa.Date(), nullable=True),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("attending_physician_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("attending_physician_other", sa.String(), nullable=True),
        sa.Column("outcome", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["attending_physician_id"], ["doctors.id"], ondelete="SET NULL"),
        *_common_columns(),
    )

    op.create_table(
        "vision_history",
        sa.Column("visit_date", sa.Date(), nullable=True),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("provider_other", sa.String(), nullable=True),
        sa.Column("rx_od", sa.String(), nullable=True),
        sa.Column("rx_os", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["provider_id"], ["doctors.id"], ondelete="SET NULL"),
        *_common_columns(),
    )

    op.create_table(
        "dental_history",
        sa.Column("visit_date", sa.Date(), nullable=True),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("provider_other", sa.String(), nullable=True),
        sa.Column("procedure", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["provider_id"], ["doctors.id"], ondelete="SET NULL"),
        *_common_columns(),
    )

    op.create_table(
        "vaccinations",
        sa.Column("vaccine", sa.String(), nullable=False),
        sa.Column("administered_date", sa.Date(), nullable=True),
        sa.Column("lot_number", sa.String(), nullable=True),
        sa.Column("administrator", sa.String(), nullable=True),
        sa.Column("next_due_date", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        *_common_columns(),
    )

    op.create_table(
        "visit_logs",
        sa.Column("visit_date", sa.Date(), nullable=True),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("doctor_other", sa.String(), nullable=True),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("follow_up", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="SET NULL"),
        *_common_columns(),
    )

    op.create_table(
        "appointments",
        sa.Column("appointment_datetime", sa.DateTime(timezone=True), nullable=False),
        sa.Column("doctor_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("doctor_other", sa.String(), nullable=True),
        sa.Column("location", sa.String(), nullable=True),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("upcoming", "completed", "cancelled", "rescheduled", name="appointment_status"),
            nullable=False,
            server_default="upcoming",
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="SET NULL"),
        *_common_columns(),
    )


def downgrade() -> None:
    op.drop_table("appointments")
    op.drop_table("visit_logs")
    op.drop_table("vaccinations")
    op.drop_table("dental_history")
    op.drop_table("vision_history")
    op.drop_table("hospitalizations")
    op.drop_table("surgeries")
    op.drop_table("family_history")
    op.drop_table("pharmacies")
    op.drop_table("insurances")
    op.execute("DROP TYPE IF EXISTS appointment_status")
