# backend/app/schemas/extended_records.py
import uuid
from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, computed_field

from app.models.extended_records import AppointmentStatus, AppointmentType


# ---- Insurance ----
class InsuranceCreate(BaseModel):
    insurer_name: str
    policy_number: str | None = None
    group_number: str | None = None
    contact_phone: str | None = None
    contact_address: str | None = None
    notes: str | None = None

class InsuranceUpdate(BaseModel):
    insurer_name: str | None = None
    policy_number: str | None = None
    group_number: str | None = None
    contact_phone: str | None = None
    contact_address: str | None = None
    notes: str | None = None

class InsuranceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    insurer_name: str
    policy_number: str | None
    group_number: str | None
    contact_phone: str | None
    contact_address: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


# ---- Pharmacy ----
class PharmacyCreate(BaseModel):
    name: str
    address: str | None = None
    phone: str | None = None
    fax: str | None = None
    notes: str | None = None

class PharmacyUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    phone: str | None = None
    fax: str | None = None
    notes: str | None = None

class PharmacyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    address: str | None
    phone: str | None
    fax: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


# ---- Family History ----
class FamilyHistoryCreate(BaseModel):
    relative: str
    condition: str
    age_of_onset: str | None = None
    notes: str | None = None

class FamilyHistoryUpdate(BaseModel):
    relative: str | None = None
    condition: str | None = None
    age_of_onset: str | None = None
    notes: str | None = None

class FamilyHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    relative: str
    condition: str
    age_of_onset: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


# ---- Surgery ----
class SurgeryCreate(BaseModel):
    procedure: str
    surgery_date: date | None = None
    surgeon_id: uuid.UUID | None = None
    surgeon_other: str | None = None
    hospital: str | None = None
    outcome: str | None = None
    notes: str | None = None

class SurgeryUpdate(BaseModel):
    procedure: str | None = None
    surgery_date: date | None = None
    surgeon_id: uuid.UUID | None = None
    surgeon_other: str | None = None
    hospital: str | None = None
    outcome: str | None = None
    notes: str | None = None

class SurgeryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    procedure: str
    surgery_date: date | None
    surgeon_id: uuid.UUID | None
    surgeon_other: str | None
    hospital: str | None
    outcome: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


# ---- Hospitalization ----
class HospitalizationCreate(BaseModel):
    facility: str
    admission_date: date | None = None
    discharge_date: date | None = None
    reason: str | None = None
    attending_physician_id: uuid.UUID | None = None
    attending_physician_other: str | None = None
    outcome: str | None = None
    notes: str | None = None

class HospitalizationUpdate(BaseModel):
    facility: str | None = None
    admission_date: date | None = None
    discharge_date: date | None = None
    reason: str | None = None
    attending_physician_id: uuid.UUID | None = None
    attending_physician_other: str | None = None
    outcome: str | None = None
    notes: str | None = None

class HospitalizationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    facility: str
    admission_date: date | None
    discharge_date: date | None
    reason: str | None
    attending_physician_id: uuid.UUID | None
    attending_physician_other: str | None
    outcome: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


# ---- Vision History ----
class VisionHistoryCreate(BaseModel):
    visit_date: date | None = None
    provider_id: uuid.UUID | None = None
    provider_other: str | None = None
    rx_od: str | None = None
    rx_os: str | None = None
    notes: str | None = None

class VisionHistoryUpdate(BaseModel):
    visit_date: date | None = None
    provider_id: uuid.UUID | None = None
    provider_other: str | None = None
    rx_od: str | None = None
    rx_os: str | None = None
    notes: str | None = None

class VisionHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    visit_date: date | None
    provider_id: uuid.UUID | None
    provider_other: str | None
    rx_od: str | None
    rx_os: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


# ---- Dental History ----
class DentalHistoryCreate(BaseModel):
    visit_date: date | None = None
    provider_id: uuid.UUID | None = None
    provider_other: str | None = None
    procedure: str | None = None
    notes: str | None = None

class DentalHistoryUpdate(BaseModel):
    visit_date: date | None = None
    provider_id: uuid.UUID | None = None
    provider_other: str | None = None
    procedure: str | None = None
    notes: str | None = None

class DentalHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    visit_date: date | None
    provider_id: uuid.UUID | None
    provider_other: str | None
    procedure: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


# ---- Vaccination ----
class VaccinationCreate(BaseModel):
    vaccine: str
    manufacturer: str | None = None
    administered_date: date | None = None
    lot_number: str | None = None
    administrator: str | None = None
    next_due_date: date | None = None
    notes: str | None = None

class VaccinationUpdate(BaseModel):
    vaccine: str | None = None
    manufacturer: str | None = None
    administered_date: date | None = None
    lot_number: str | None = None
    administrator: str | None = None
    next_due_date: date | None = None
    notes: str | None = None

class VaccinationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    vaccine: str
    manufacturer: str | None
    administered_date: date | None
    lot_number: str | None
    administrator: str | None
    next_due_date: date | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


# ---- Visit Log ----
class VisitLogCreate(BaseModel):
    visit_date: date | None = None
    visit_time: time | None = None
    doctor_id: uuid.UUID | None = None
    doctor_other: str | None = None
    reason: str | None = None
    summary: str | None = None
    follow_up: str | None = None
    follow_up_date: date | None = None
    notes: str | None = None

class VisitLogUpdate(BaseModel):
    visit_date: date | None = None
    visit_time: time | None = None
    doctor_id: uuid.UUID | None = None
    doctor_other: str | None = None
    reason: str | None = None
    summary: str | None = None
    follow_up: str | None = None
    follow_up_date: date | None = None
    notes: str | None = None

class VisitLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    visit_date: date | None
    visit_time: time | None
    doctor_id: uuid.UUID | None
    doctor_other: str | None
    reason: str | None
    summary: str | None
    follow_up: str | None
    follow_up_date: date | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


# ---- Appointment ----
class AppointmentCreate(BaseModel):
    appointment_datetime: datetime
    doctor_id: uuid.UUID | None = None
    doctor_other: str | None = None
    appointment_type: AppointmentType | None = None
    location: str | None = None
    reason: str | None = None
    status: AppointmentStatus = AppointmentStatus.upcoming
    notes: str | None = None

class AppointmentUpdate(BaseModel):
    appointment_datetime: datetime | None = None
    doctor_id: uuid.UUID | None = None
    doctor_other: str | None = None
    appointment_type: AppointmentType | None = None
    location: str | None = None
    reason: str | None = None
    status: AppointmentStatus | None = None
    notes: str | None = None

class AppointmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    appointment_datetime: datetime
    doctor_id: uuid.UUID | None
    doctor_other: str | None
    appointment_type: AppointmentType | None
    location: str | None
    reason: str | None
    status: AppointmentStatus
    notes: str | None
    created_at: datetime
    updated_at: datetime


# ---- Vitals ----
class VitalsCreate(BaseModel):
    measured_at: datetime
    bp_systolic: int | None = None
    bp_diastolic: int | None = None
    pulse_bpm: int | None = None
    height_in: float | None = None
    weight_lb: float | None = None
    temperature_f: float | None = None
    respiratory_rate: int | None = None
    spo2: int | None = None
    blood_glucose: int | None = None
    notes: str | None = None
    visit_log_id: uuid.UUID | None = None


class VitalsUpdate(BaseModel):
    measured_at: datetime | None = None
    bp_systolic: int | None = None
    bp_diastolic: int | None = None
    pulse_bpm: int | None = None
    height_in: float | None = None
    weight_lb: float | None = None
    temperature_f: float | None = None
    respiratory_rate: int | None = None
    spo2: int | None = None
    blood_glucose: int | None = None
    notes: str | None = None
    visit_log_id: uuid.UUID | None = None


class VitalsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    measured_at: datetime
    bp_systolic: int | None
    bp_diastolic: int | None
    pulse_bpm: int | None
    height_in: float | None
    weight_lb: float | None
    temperature_f: float | None
    respiratory_rate: int | None
    spo2: int | None
    blood_glucose: int | None
    notes: str | None
    visit_log_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def bmi(self) -> float | None:
        if self.height_in and self.weight_lb and self.height_in > 0:
            return round(703 * float(self.weight_lb) / (float(self.height_in) ** 2), 1)
        return None
