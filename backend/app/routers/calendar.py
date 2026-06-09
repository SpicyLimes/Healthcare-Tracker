# backend/app/routers/calendar.py
from datetime import date, datetime
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.security.dependencies import get_current_user
from app.models.doctor import Doctor
from app.models.extended_records import (
    Appointment, Hospitalization, Surgery, Vaccination, VisitLog,
)
from app.models.medication import Medication
from app.models.user import User
from app.schemas.calendar import CalendarEventResponse

router = APIRouter(tags=["calendar"])

COLORS = {
    "appointment": "#3b82f6",
    "visit_log": "#8b5cf6",
    "vaccination": "#10b981",
    "surgery": "#ef4444",
    "hospitalization": "#f97316",
    "medication": "#eab308",
}

APPOINTMENT_TYPE_LABELS = {
    "annual_checkup": "Annual Checkup",
    "follow_up": "Follow-up",
    "specialist": "Specialist",
    "lab": "Lab/Blood Work",
    "imaging": "Imaging",
    "dental": "Dental",
    "vision": "Vision",
    "other": "Other",
}


def _to_iso(d) -> str:
    if isinstance(d, datetime):
        return d.date().isoformat()
    if isinstance(d, date):
        return d.isoformat()
    return str(d)


@router.get("/api/calendar/events", response_model=List[CalendarEventResponse])
def get_calendar_events(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    events: list[dict] = []

    # Appointments — join Doctor for doctor_name
    appt_rows = db.execute(
        select(Appointment, Doctor.name.label("doctor_name"))
        .outerjoin(Doctor, Appointment.doctor_id == Doctor.id)
        .where(Appointment.appointment_datetime.is_not(None))
    ).all()
    for a, doc_name in appt_rows:
        title = a.reason or APPOINTMENT_TYPE_LABELS.get(
            a.appointment_type.value if a.appointment_type else "", "Appointment"
        ) or "Appointment"
        doctor_name = doc_name or a.doctor_other or None
        appt_dt: datetime = a.appointment_datetime
        time_str = appt_dt.strftime("%H:%M") if appt_dt else None
        events.append({
            "id": str(a.id),
            "type": "appointment",
            "title": title,
            "date": _to_iso(appt_dt),
            "end_date": None,
            "color": COLORS["appointment"],
            "doctor_name": doctor_name,
            "time": time_str,
        })

    # Visit Logs
    visits = db.execute(
        select(VisitLog).where(
            VisitLog.visit_date.is_not(None),
        )
    ).scalars().all()
    for v in visits:
        events.append({
            "id": str(v.id),
            "type": "visit_log",
            "title": v.reason or "Visit",
            "date": _to_iso(v.visit_date),
            "end_date": None,
            "color": COLORS["visit_log"],
        })

    # Vaccinations
    vacs = db.execute(
        select(Vaccination).where(
            Vaccination.administered_date.is_not(None),
        )
    ).scalars().all()
    for v in vacs:
        events.append({
            "id": str(v.id),
            "type": "vaccination",
            "title": v.vaccine,
            "date": _to_iso(v.administered_date),
            "end_date": None,
            "color": COLORS["vaccination"],
        })

    # Surgeries
    surgs = db.execute(
        select(Surgery).where(
            Surgery.surgery_date.is_not(None),
        )
    ).scalars().all()
    for s in surgs:
        events.append({
            "id": str(s.id),
            "type": "surgery",
            "title": s.procedure,
            "date": _to_iso(s.surgery_date),
            "end_date": None,
            "color": COLORS["surgery"],
        })

    # Hospitalizations
    hosps = db.execute(
        select(Hospitalization).where(
            Hospitalization.admission_date.is_not(None),
        )
    ).scalars().all()
    for h in hosps:
        if h.discharge_date and h.discharge_date < h.admission_date:
            continue
        title = h.facility
        if h.reason:
            title = f"{h.facility} — {h.reason}"
        end = _to_iso(h.discharge_date) if h.discharge_date else None
        events.append({
            "id": str(h.id),
            "type": "hospitalization",
            "title": title,
            "date": _to_iso(h.admission_date),
            "end_date": end,
            "color": COLORS["hospitalization"],
        })

    # Medications
    meds = db.execute(
        select(Medication).where(
            Medication.start_date.is_not(None),
        )
    ).scalars().all()
    for m in meds:
        if m.end_date and m.end_date < m.start_date:
            continue
        title = m.name
        if m.dose:
            title = f"{m.name} {m.dose}"
        end = _to_iso(m.end_date) if m.end_date else None
        events.append({
            "id": str(m.id),
            "type": "medication",
            "title": title,
            "date": _to_iso(m.start_date),
            "end_date": end,
            "color": COLORS["medication"],
        })

    events.sort(key=lambda e: e["date"])
    return events
