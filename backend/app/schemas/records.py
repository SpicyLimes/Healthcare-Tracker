import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.ailment import AilmentStatus
from app.models.medication import MedicationKind


# ---- Profile (singleton) ----
class ProfileWrite(BaseModel):
    full_name: str
    date_of_birth: date | None = None
    blood_type: str | None = None
    allergies: str | None = None
    emergency_contacts: str | None = None
    primary_language: str | None = None
    height: str | None = None
    weight: str | None = None
    phone: str | None = None
    notes: str | None = None


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
    created_at: datetime
    updated_at: datetime


# ---- Medications ----
class MedicationCreate(BaseModel):
    name: str
    kind: MedicationKind = MedicationKind.medication
    dose: str | None = None
    frequency: str | None = None
    route: str | None = None
    prescribing_doctor: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool = True
    notes: str | None = None


class MedicationUpdate(BaseModel):
    name: str | None = None
    kind: MedicationKind | None = None
    dose: str | None = None
    frequency: str | None = None
    route: str | None = None
    prescribing_doctor: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_active: bool | None = None
    notes: str | None = None


class MedicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    kind: MedicationKind
    dose: str | None
    frequency: str | None
    route: str | None
    prescribing_doctor: str | None
    start_date: date | None
    end_date: date | None
    is_active: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime


# ---- Doctors ----
class DoctorCreate(BaseModel):
    name: str
    specialty: str | None = None
    practice: str | None = None
    phone: str | None = None
    fax: str | None = None
    address: str | None = None
    patient_portal_url: str | None = None
    notes: str | None = None


class DoctorUpdate(BaseModel):
    name: str | None = None
    specialty: str | None = None
    practice: str | None = None
    phone: str | None = None
    fax: str | None = None
    address: str | None = None
    patient_portal_url: str | None = None
    notes: str | None = None


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
    condition: str
    onset_date: date | None = None
    status: AilmentStatus = AilmentStatus.active
    treating_doctor: str | None = None
    notes: str | None = None


class AilmentUpdate(BaseModel):
    condition: str | None = None
    onset_date: date | None = None
    status: AilmentStatus | None = None
    treating_doctor: str | None = None
    notes: str | None = None


class AilmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    condition: str
    onset_date: date | None
    status: AilmentStatus
    treating_doctor: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
