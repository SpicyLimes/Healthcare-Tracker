import uuid
from datetime import date, datetime

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.models.ailment import AilmentStatus
from app.models.medication import MedicationKind


# ---- Profile (singleton) ----
class ProfileWrite(BaseModel):
    full_name: str = Field(max_length=512)
    date_of_birth: date | None = None
    blood_type: str | None = Field(default=None, max_length=16)
    allergies: str | None = Field(default=None, max_length=10_000)
    emergency_contacts: str | None = Field(default=None, max_length=10_000)
    primary_language: str | None = Field(default=None, max_length=64)
    height: str | None = Field(default=None, max_length=32)
    weight: str | None = Field(default=None, max_length=32)
    phone: str | None = Field(default=None, max_length=32)
    notes: str | None = Field(default=None, max_length=50_000)
    main_doctor_id: uuid.UUID | None = None


class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    date_of_birth: date | None
    blood_type: str | None
    allergies: str | None
    emergency_contacts: str | None
    primary_language: str | None
    height: str | None
    weight: str | None
    phone: str | None
    notes: str | None
    main_doctor_id: uuid.UUID | None
    # Resolved server-side. No free-text twin exists for the primary doctor,
    # so this is linked-or-None.
    main_doctor: str | None = Field(
        default=None,
        validation_alias=AliasChoices("main_doctor_display", "main_doctor"),
    )
    created_at: datetime
    updated_at: datetime


# ---- Medications ----
class MedicationCreate(BaseModel):
    name: str = Field(max_length=256)
    kind: MedicationKind = MedicationKind.medication
    dose: str | None = Field(default=None, max_length=128)
    frequency: str | None = Field(default=None, max_length=128)
    route: str | None = Field(default=None, max_length=128)
    prescribing_doctor: str | None = Field(default=None, max_length=256)
    prescribing_doctor_id: uuid.UUID | None = None
    pharmacy_id: uuid.UUID | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool = True
    notes: str | None = Field(default=None, max_length=50_000)


class MedicationUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=256)
    kind: MedicationKind | None = None
    dose: str | None = Field(default=None, max_length=128)
    frequency: str | None = Field(default=None, max_length=128)
    route: str | None = Field(default=None, max_length=128)
    prescribing_doctor: str | None = Field(default=None, max_length=256)
    prescribing_doctor_id: uuid.UUID | None = None
    pharmacy_id: uuid.UUID | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None
    notes: str | None = Field(default=None, max_length=50_000)


class MedicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    kind: MedicationKind
    dose: str | None
    frequency: str | None
    route: str | None
    # Resolved server-side: linked doctor's name, else the free-text value.
    prescribing_doctor: str | None = Field(
        default=None,
        validation_alias=AliasChoices("prescribing_doctor_display", "prescribing_doctor"),
    )
    prescribing_doctor_id: uuid.UUID | None
    pharmacy_id: uuid.UUID | None = None
    pharmacy_name: str | None = None
    start_date: date | None
    end_date: date | None
    is_active: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime


# ---- Doctors ----
class DoctorCreate(BaseModel):
    name: str = Field(max_length=256)
    specialty: str | None = Field(default=None, max_length=256)
    practice: str | None = Field(default=None, max_length=256)
    phone: str | None = Field(default=None, max_length=32)
    fax: str | None = Field(default=None, max_length=32)
    address: str | None = Field(default=None, max_length=1_000)
    patient_portal_url: str | None = Field(default=None, max_length=2_048)
    notes: str | None = Field(default=None, max_length=50_000)


class DoctorUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=256)
    specialty: str | None = Field(default=None, max_length=256)
    practice: str | None = Field(default=None, max_length=256)
    phone: str | None = Field(default=None, max_length=32)
    fax: str | None = Field(default=None, max_length=32)
    address: str | None = Field(default=None, max_length=1_000)
    patient_portal_url: str | None = Field(default=None, max_length=2_048)
    notes: str | None = Field(default=None, max_length=50_000)


class DoctorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    specialty: str | None
    practice: str | None
    phone: str | None
    fax: str | None
    address: str | None
    patient_portal_url: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


# ---- Ailments ----
class AilmentCreate(BaseModel):
    condition: str = Field(max_length=512)
    onset_date: date | None = None
    status: AilmentStatus = AilmentStatus.active
    treating_doctor: str | None = Field(default=None, max_length=256)
    treating_doctor_id: uuid.UUID | None = None
    notes: str | None = Field(default=None, max_length=50_000)


class AilmentUpdate(BaseModel):
    condition: str | None = Field(default=None, max_length=512)
    onset_date: date | None = None
    status: AilmentStatus | None = None
    treating_doctor: str | None = Field(default=None, max_length=256)
    treating_doctor_id: uuid.UUID | None = None
    notes: str | None = Field(default=None, max_length=50_000)


class AilmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    condition: str
    onset_date: date | None
    status: AilmentStatus
    # Resolved server-side: linked doctor name, else the free-text value.
    # Reuses the existing field name, so the API shape is unchanged.
    treating_doctor: str | None = Field(
        default=None,
        validation_alias=AliasChoices("treating_doctor_display", "treating_doctor"),
    )
    treating_doctor_id: uuid.UUID | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
