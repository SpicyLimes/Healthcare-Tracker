# backend/app/services/summary_service.py
import html as _html
import json as _json
from datetime import date, datetime, timezone
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.routers.guest import _get_section_map


def get_section_map() -> dict[str, tuple[Any, Any]]:
    """Reuse the guest router's section map (name -> (model, response schema))."""
    return _get_section_map()


def gather_section_rows(
    db: Session,
    section: str,
    date_from: Optional[date],
    date_to: Optional[date],
) -> list[dict[str, Any]]:
    """Return validated records for a section as plain dicts, optionally filtered by created_at date."""
    # nutrition_plan: combine acceptable + unacceptable foods (mirrors guest endpoint)
    if section == "nutrition_plan":
        from app.models.nutrition import NutritionAcceptableFood, NutritionUnacceptableFood
        result = []
        for row in db.scalars(select(NutritionAcceptableFood)).all():
            result.append({"type": "Acceptable", "food_name": row.food_name})
        for row in db.scalars(select(NutritionUnacceptableFood)).all():
            result.append({"type": "Unacceptable", "food_name": row.food_name})
        return result

    section_map = get_section_map()
    if section not in section_map:
        return []
    model, schema = section_map[section]
    rows = list(db.scalars(select(model)).all())

    # visit_logs: attach ALL vitals fields from the linked Vitals row.
    # Reuse the visit_logs router's helper so every field VisitLogResponse
    # declares is populated — attaching only bp/pulse left height/weight/temp/
    # resp/spo2/glucose missing and model_validate raised (500 on the summary).
    if section == "visit_logs":
        from app.routers.visit_logs import _attach_vitals_batch
        _attach_vitals_batch(rows, db)

    # insurances: inactive policies are excluded from summaries by design.
    if section == "insurances":
        rows = [r for r in rows if getattr(r, "is_active", True)]

    result = []
    for row in rows:
        created = getattr(row, "created_at", None)
        if created is not None:
            created_date = created.date() if hasattr(created, "date") else created
            if date_from is not None and created_date < date_from:
                continue
            if date_to is not None and created_date > date_to:
                continue
        result.append(schema.model_validate(row).model_dump(mode="json"))
    return result


# Human-readable section titles (matches the app's labels)
SECTION_TITLES: dict[str, str] = {
    "medications": "Medications",
    "doctors": "Doctors",
    "ailments": "Ailment History",
    "profile": "Profile",
    "surgeries": "Procedures",
    "hospitalizations": "Hospitalizations",
    "vision_history": "Vision History",
    "dental_history": "Dental History",
    "visit_logs": "Visit & Call Logs",
    "vitals": "Vitals",
    "appointments": "Appointments",
    "vaccinations": "Vaccinations",
    "insurances": "Insurance",
    "pharmacies": "Pharmacies",
    "family_history": "Family History",
    "nutrition_plan": "Nutrition Plan",
}

# Clinical reading order for the printed summary. A doctor scans top-down, so
# the order must not depend on which checkboxes were ticked first — two
# printouts of identical content used to differ. Allergies live on the profile
# and medications drive interaction checks; HL7 C-CDA, ISO 27269 IPS and AHRQ
# all put those first. Mirrors CLINICAL_ORDER in frontend/src/lib/section-labels.ts.
CANONICAL_ORDER: list[str] = [
    "profile",
    "medications",
    "ailments",
    "vitals",
    "visit_logs",
    "appointments",
    "surgeries",
    "hospitalizations",
    "vaccinations",
    "doctors",
    "vision_history",
    "dental_history",
    "insurances",
    "pharmacies",
    "family_history",
    "nutrition_plan",
]


def sort_sections(sections: list[str]) -> list[str]:
    """Canonical reading order; unknown sections keep their relative place at the end."""
    return sorted(
        sections,
        key=lambda s: CANONICAL_ORDER.index(s) if s in CANONICAL_ORDER else len(CANONICAL_ORDER),
    )


_HIDDEN_KEYS = {"id", "created_at", "updated_at"}

# Free-text doctor columns. Each is now resolved into a role-labelled field
# (surgeon, attending_physician, provider, doctor, treating_doctor) that falls
# back to this same value, so printing both would duplicate the name and show
# a raw "… Other" header on the doctor-facing sheet.
_REDUNDANT_FREETEXT_KEYS = {
    "surgeon_other",
    "attending_physician_other",
    "provider_other",
    "doctor_other",
}


def _is_hidden(key: str) -> bool:
    return key in _HIDDEN_KEYS or key in _REDUNDANT_FREETEXT_KEYS or key.endswith("_id")


def _esc(value: object) -> str:
    if value is None:
        return ""
    return _html.escape(str(value))


def _humanize(key: str) -> str:
    return key.replace("_", " ").title()


# Friendly labels for enum-valued fields, mirroring the app's dropdowns so the
# printout reads "In-Person"/"Out-Patient" rather than the raw stored keys.
_VALUE_LABELS: dict[str, dict[str, str]] = {
    "visit_type": {
        "in_person": "In-Person",
        "phone_call": "Phone Call",
        "telehealth": "Telehealth",
        "other": "Other",
    },
    "procedure_type": {
        "surgery": "Surgery",
        "outpatient": "Out-Patient",
        "clinic": "Clinic",
    },
}


def _format_allergies(raw: str) -> str:
    """"Penicillin — Anaphylaxis; Sulfa — Rash" from the stored JSON."""
    try:
        items = _json.loads(raw)
    except (ValueError, TypeError):
        return raw
    if not isinstance(items, list):
        return raw
    parts = []
    for item in items:
        if not isinstance(item, dict):
            continue
        bits = [str(item.get(k, "")).strip() for k in ("medication", "reaction")]
        joined = " — ".join(b for b in bits if b)
        if joined:
            parts.append(joined)
    return "; ".join(parts) if parts else raw


def _format_contacts(raw: str) -> str:
    """"Jane Doe · Daughter · 555-0100 (POA)" from the stored JSON."""
    try:
        items = _json.loads(raw)
    except (ValueError, TypeError):
        return raw
    if not isinstance(items, list):
        return raw
    parts = []
    for item in items:
        if not isinstance(item, dict):
            continue
        bits = [str(item.get(k, "")).strip() for k in ("name", "relationship", "phone")]
        joined = " · ".join(b for b in bits if b)
        if joined:
            parts.append(joined + (" (POA)" if item.get("is_poa") else ""))
    return "; ".join(parts) if parts else raw


# JSON-encoded columns. Without this the two most safety-critical fields on the
# sheet reach a clinician as bracket-and-quote soup, and may simply be skipped.
_JSON_FORMATTERS = {
    "allergies": _format_allergies,
    "emergency_contacts": _format_contacts,
}


def _display_value(key: str, value: object) -> object:
    formatter = _JSON_FORMATTERS.get(key)
    if formatter and isinstance(value, str) and value.strip():
        return formatter(value)
    if key == "is_active" and isinstance(value, bool):
        return "Active" if value else "Stopped"
    labels = _VALUE_LABELS.get(key)
    if labels and isinstance(value, str):
        return labels.get(value, value)
    return value


def _render_section(section: str, rows: list[dict]) -> str:
    title = SECTION_TITLES.get(section, _humanize(section))
    if not rows:
        return f"<section><h2>{_esc(title)}</h2><p class='empty'>No records.</p></section>"
    columns = [k for k in rows[0].keys() if not _is_hidden(k)]
    head = "".join(f"<th>{_esc(_humanize(c))}</th>" for c in columns)
    body = ""
    for row in rows:
        cells = "".join(f"<td>{_esc(_display_value(c, row.get(c)))}</td>" for c in columns)
        body += f"<tr>{cells}</tr>"
    return (
        f"<section><h2>{_esc(title)}</h2>"
        f"<table><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></section>"
    )


def render_summary(req: "SummaryRequest", section_data: dict[str, list[dict]], patient: dict | None) -> str:
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    header_bits = [f"<div class='gen'>Generated {generated}"]
    if req.prepared_for:
        header_bits.append(f"<br>Prepared for: {_esc(req.prepared_for)}")
    header_bits.append("</div>")

    patient_block = ""
    if req.include_patient_header and patient:
        name = _esc(patient.get("full_name"))
        dob = _esc(patient.get("date_of_birth"))
        patient_block = f"<div class='patient'><strong>{name}</strong>"
        if dob:
            patient_block += f" · DOB {dob}"
        patient_block += "</div>"

    sections_html = "".join(
        _render_section(s, section_data.get(s, [])) for s in sort_sections(req.sections)
    )

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>{_esc(req.title)}</title>
<style>
  body {{ font-family: system-ui, sans-serif; color: #111; margin: 24px; }}
  .top {{ display: flex; justify-content: space-between; border-bottom: 2px solid #111; padding-bottom: 8px; }}
  h1 {{ font-size: 20px; margin: 0; }}
  h2 {{ font-size: 14px; margin: 18px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 2px; }}
  .gen {{ text-align: right; color: #555; font-size: 12px; }}
  .patient {{ margin-top: 4px; color: #333; font-size: 13px; }}
  table {{ width: 100%; border-collapse: collapse; font-size: 12px; }}
  th, td {{ text-align: left; padding: 4px 6px; border-bottom: 1px solid #eee; vertical-align: top; }}
  th {{ color: #555; font-weight: 600; }}
  .empty {{ color: #888; font-size: 12px; }}
  section {{ page-break-inside: avoid; }}
  @media print {{
    body {{ margin: 0; }}
    button, .noprint {{ display: none !important; }}
  }}
</style></head>
<body>
  <div class="top">
    <div><h1>{_esc(req.title)}</h1>{patient_block}</div>
    {''.join(header_bits)}
  </div>
  {sections_html}
</body></html>"""
