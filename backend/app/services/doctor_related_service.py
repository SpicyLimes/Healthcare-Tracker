"""Reverse lookup: every record that points at a given doctor.

A doctor was only ever a row of contact details. Answering the standard
pre-appointment question — "what has this doctor prescribed, treated, and
operated on?" — meant opening eight pages and reading each one for the name.

The nine role-typed FKs already hold this; nothing read them in reverse. The
role is the point: "Prescriber (4 medications)" says something that a flat list
of nine records does not, which is why each group keeps its clinical label
rather than being merged into one pile.
"""
from dataclasses import dataclass
from typing import Any, Callable
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ailment import Ailment
from app.models.extended_records import (
    Appointment,
    DentalHistory,
    Hospitalization,
    Surgery,
    VisionHistory,
    VisitLog,
)
from app.models.medication import Medication
from app.models.profile import Profile


@dataclass(frozen=True)
class RelatedGroup:
    """One clinical role a doctor plays, plus the records where they play it."""

    role: str            # human-readable: "Prescriber", "Surgeon", ...
    section: str         # section key, so the UI can link to the right page
    count: int
    items: list[dict[str, Any]]


def _title(*parts: Any) -> str:
    """Join the non-empty parts of a record's identity into one line."""
    return " — ".join(str(p) for p in parts if p)


# (model, FK attribute, role label, section key, date attr, title builder).
# Ordered by how a clinician reads a chart: what you're on, what you have, then
# what was done to you, then encounters.
_SOURCES: list[tuple[Any, str, str, str, str | None, Callable[[Any], str]]] = [
    (Medication, "prescribing_doctor_id", "Prescriber", "medications",
     "start_date", lambda r: _title(r.name, r.dose)),
    (Ailment, "treating_doctor_id", "Treating", "ailments",
     "onset_date", lambda r: _title(r.condition)),
    (Surgery, "surgeon_id", "Surgeon", "surgeries",
     "surgery_date", lambda r: _title(r.procedure)),
    (Hospitalization, "attending_physician_id", "Attending", "hospitalizations",
     "admission_date", lambda r: _title(r.facility, r.reason)),
    # Vision has no procedure/type column; the prescription IS the record.
    (VisionHistory, "provider_id", "Vision Provider", "vision_history",
     "visit_date", lambda r: _title(*(f"Rx {eye}: {v}" for eye, v in
                                      (("OD", r.rx_od), ("OS", r.rx_os)) if v)) or "Eye exam"),
    (DentalHistory, "provider_id", "Dental Provider", "dental_history",
     "visit_date", lambda r: _title(r.procedure)),
    (VisitLog, "doctor_id", "Seen At Visit", "visit_logs",
     "visit_date", lambda r: _title(r.reason)),
    (Appointment, "doctor_id", "Appointment", "appointments",
     "appointment_datetime", lambda r: _title(r.reason)),
]


def related_records(db: Session, doctor_id: uuid.UUID) -> list[RelatedGroup]:
    """Every record linked to this doctor, grouped by the role they played.

    Only linked (FK) records count. A free-text twin naming the same person is
    deliberately excluded: it is unresolved by definition, so counting it would
    make the totals unverifiable.
    """
    groups: list[RelatedGroup] = []

    for model, fk, role, section, date_attr, make_title in _SOURCES:
        rows = db.scalars(
            select(model).where(getattr(model, fk) == doctor_id)
        ).all()
        if not rows:
            continue

        items = []
        for r in rows:
            raw_date = getattr(r, date_attr, None) if date_attr else None
            items.append({
                "id": str(r.id),
                "title": make_title(r) or "(untitled)",
                "date": raw_date.isoformat() if raw_date is not None else None,
            })
        # Newest first; undated records sort last rather than crashing the compare.
        items.sort(key=lambda i: (i["date"] is not None, i["date"] or ""), reverse=True)
        groups.append(RelatedGroup(role=role, section=section, count=len(items), items=items))

    # Profile is the one singleton: "this is the primary care doctor" is a fact
    # about the patient, not a record with a date, so it carries no items.
    is_main = db.scalar(
        select(Profile.id).where(Profile.main_doctor_id == doctor_id).limit(1)
    )
    if is_main is not None:
        groups.insert(0, RelatedGroup(role="Primary Care", section="profile", count=1, items=[]))

    return groups
