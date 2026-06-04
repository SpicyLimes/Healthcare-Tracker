"""core records: profile, medications, doctors, ailments

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-04

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
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
        "profile",
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=True),
        sa.Column("blood_type", sa.String(), nullable=True),
        sa.Column("allergies", sa.Text(), nullable=True),
        sa.Column("emergency_contacts", sa.Text(), nullable=True),
        sa.Column("primary_language", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        *_common_columns(),
    )

    op.create_table(
        "medications",
        sa.Column("name", sa.String(), nullable=False),
        sa.Column(
            "kind",
            sa.Enum("medication", "vitamin", "supplement", name="medication_kind"),
            nullable=False,
            server_default="medication",
        ),
        sa.Column("dose", sa.String(), nullable=True),
        sa.Column("frequency", sa.String(), nullable=True),
        sa.Column("prescribing_doctor", sa.String(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("notes", sa.Text(), nullable=True),
        *_common_columns(),
    )

    op.create_table(
        "doctors",
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("specialty", sa.String(), nullable=True),
        sa.Column("practice", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("fax", sa.String(), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("patient_portal_url", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        *_common_columns(),
    )

    op.create_table(
        "ailments",
        sa.Column("condition", sa.String(), nullable=False),
        sa.Column("onset_date", sa.Date(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("active", "resolved", name="ailment_status"),
            nullable=False,
            server_default="active",
        ),
        sa.Column("treating_doctor", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        *_common_columns(),
    )


def downgrade() -> None:
    op.drop_table("ailments")
    op.drop_table("doctors")
    op.drop_table("medications")
    op.drop_table("profile")
    op.execute("DROP TYPE IF EXISTS ailment_status")
    op.execute("DROP TYPE IF EXISTS medication_kind")
