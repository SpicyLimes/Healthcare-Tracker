# backend/app/routers/calendar.py
from datetime import date, datetime

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

# Darkened to the -600/-700 steps so white chip text clears WCAG AA (4.5:1) at
# the 10px size the month grid uses. The -500 steps measured 1.92:1 (medication)
# to 4.23:1 (visit_log) — all failing, worst on the yellow.
COLORS = {
    "appointment": "#1d4ed8",
    "visit_log": "#6d28d9",
    "vaccination": "#047857",
    "surgery": "#b91c1c",
    "hospitalization": "#c2410c",
    "medication": "#a16207",
    "follow_up": "#0f766e",
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


@router.get("/api/calendar/events", response_model=list[CalendarEventResponse])
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

    # Visit Logs — exclude any that were auto-created from a completed appointment
    auto_vl_ids = select(Appointment.visit_log_id).where(Appointment.visit_log_id.is_not(None)).scalar_subquery()
    visits = db.execute(
        select(VisitLog).where(
            VisitLog.visit_date.is_not(None),
            ~VisitLog.id.in_(auto_vl_ids),
        )
    ).scalars().all()
    for v in visits:
        if v.visit_type in ("phone_call", "telehealth"):
            title = f"Call: {v.reason}" if v.reason else "Call"
        else:
            title = v.reason or "Visit"
        events.append({
            "id": str(v.id),
            "type": "visit_log",
            "title": title,
            "date": _to_iso(v.visit_date),
            "end_date": None,
            "color": COLORS["visit_log"],
        })
        # Follow-up dates were captured on the visit-log form and read by
        # nothing — typing "recheck A1c" with a date FELT like scheduling it,
        # but it never reached the calendar, the dashboard, or Upcoming Events.
        # Projected read-only: no row is written and no appointment is created,
        # so this cannot duplicate a real appointment the user also books.
        if v.follow_up_date is not None:
            events.append({
                "id": f"{v.id}:follow-up",
                "type": "follow_up",
                "title": f"Follow-up: {v.reason}" if v.reason else "Follow-up",
                "date": _to_iso(v.follow_up_date),
                "end_date": None,
                "color": COLORS["follow_up"],
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
