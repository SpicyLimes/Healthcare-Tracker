"""AI write concerns: the write-capable section map, a non-raising field
validator, and the in-process confirmation-token store. NO endpoint logic here."""
from __future__ import annotations

import secrets
import time
import uuid
from typing import Any, Literal

from pydantic import BaseModel, TypeAdapter

from app.models.ailment import Ailment
from app.models.doctor import Doctor
from app.models.extended_records import (
    Appointment, DentalHistory, FamilyHistory, Hospitalization, Insurance,
    Pharmacy, Surgery, Vaccination, VisionHistory, VisitLog,
)
from app.models.medication import Medication
from app.schemas.extended_records import (
    AppointmentCreate, AppointmentUpdate, DentalHistoryCreate, DentalHistoryUpdate,
    FamilyHistoryCreate, FamilyHistoryUpdate, HospitalizationCreate, HospitalizationUpdate,
    InsuranceCreate, InsuranceUpdate, PharmacyCreate, PharmacyUpdate,
    SurgeryCreate, SurgeryUpdate, VaccinationCreate, VaccinationUpdate,
    VisionHistoryCreate, VisionHistoryUpdate, VisitLogCreate, VisitLogUpdate,
)
from app.schemas.records import (
    AilmentCreate, AilmentUpdate, DoctorCreate, DoctorUpdate,
    MedicationCreate, MedicationUpdate,
)

# name -> (SQLAlchemy model, *Create schema, *Update schema)
WRITE_SECTION_MAP: dict[str, tuple[type, type[BaseModel], type[BaseModel]]] = {
    "medications": (Medication, MedicationCreate, MedicationUpdate),
    "doctors": (Doctor, DoctorCreate, DoctorUpdate),
    "ailments": (Ailment, AilmentCreate, AilmentUpdate),
    "surgeries": (Surgery, SurgeryCreate, SurgeryUpdate),
    "hospitalizations": (Hospitalization, HospitalizationCreate, HospitalizationUpdate),
    "vision_history": (VisionHistory, VisionHistoryCreate, VisionHistoryUpdate),
    "dental_history": (DentalHistory, DentalHistoryCreate, DentalHistoryUpdate),
    "visit_logs": (VisitLog, VisitLogCreate, VisitLogUpdate),
    "appointments": (Appointment, AppointmentCreate, AppointmentUpdate),
    "vaccinations": (Vaccination, VaccinationCreate, VaccinationUpdate),
    "insurances": (Insurance, InsuranceCreate, InsuranceUpdate),
    "pharmacies": (Pharmacy, PharmacyCreate, PharmacyUpdate),
    "family_history": (FamilyHistory, FamilyHistoryCreate, FamilyHistoryUpdate),
}


def write_section_names() -> list[str]:
    """The section names the AI may write to (used to enum-constrain tool args)."""
    return list(WRITE_SECTION_MAP.keys())


def validate_fields(section: str, fields: dict, mode: Literal["create", "update"]) -> tuple[dict[str, Any], list[str]]:
    """Validate `fields` against the section's create/update schema WITHOUT raising.
    Returns (cleaned_fields, warnings). Valid values coerce through; invalid or
    unknown ones are dropped and described in warnings. Never raises."""
    entry = WRITE_SECTION_MAP.get(section)
    if entry is None:
        return {}, [f"Unknown writable section '{section}'."]
    _, create_schema, update_schema = entry
    schema = create_schema if mode == "create" else update_schema

    cleaned: dict[str, Any] = {}
    warnings: list[str] = []

    # Validate each field against ITS OWN type, independently — so a missing
    # required field never poisons a valid one, and one bad value never discards
    # the whole proposal.
    for key, value in fields.items():
        field = schema.model_fields.get(key)
        if field is None:
            warnings.append(f"Ignored unknown field '{key}' for {section}.")
            continue
        try:
            cleaned[key] = TypeAdapter(field.annotation).validate_python(value)
        except Exception:
            warnings.append(f"Could not use value for '{key}' ({value!r}); left blank.")
    return cleaned, warnings


class TokenStore:
    """In-process, single-use, TTL-bounded store of staged edit/delete actions.
    One instance is created per chat request, so tokens are inherently scoped to
    the conversation and never persist or leave the server."""

    def __init__(self, ttl_seconds: int = 300):
        self._ttl = ttl_seconds
        self._staged: dict[str, tuple[float, dict]] = {}

    def stage(self, action: dict) -> str:
        token = secrets.token_urlsafe(16)
        self._staged[token] = (time.monotonic(), action)
        return token

    def consume(self, token: str) -> dict | None:
        entry = self._staged.pop(token, None)   # pop = single use
        if entry is None:
            return None
        staged_at, action = entry
        if time.monotonic() - staged_at > self._ttl:
            return None
        return action


def row_summary(row, keys=None) -> dict:
    """Plain-dict snapshot of a model row for human read-back. Skips nothing but
    coerces dates/UUIDs to strings. If `keys` is given, only those columns."""
    cols = [c.name for c in row.__table__.columns]
    if keys is not None:
        wanted = set(keys)
        cols = [c for c in cols if c in wanted]
    return {c: _jsonable(getattr(row, c)) for c in cols}


def row_summary_values(values: dict) -> dict:
    """JSON-safe coercion of a plain dict of field values (mirror of row_summary
    for proposed/after values), so before/after read back consistently."""
    return {k: _jsonable(v) for k, v in values.items()}


def _jsonable(v):
    if v is None:
        return None
    if hasattr(v, "isoformat"):      # date / datetime
        return v.isoformat()
    if isinstance(v, uuid.UUID):
        return str(v)
    return v
