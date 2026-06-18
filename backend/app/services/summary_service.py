# backend/app/services/summary_service.py
import html as _html
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

    # visit_logs: attach BP fields from linked Vitals row
    if section == "visit_logs":
        from app.models.extended_records import Vitals
        for row in rows:
            linked = db.get(Vitals, row.linked_vitals_id) if row.linked_vitals_id else None
            row.bp_systolic = linked.bp_systolic if linked else None
            row.bp_diastolic = linked.bp_diastolic if linked else None
            row.pulse_bpm = linked.pulse_bpm if linked else None

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
    "surgeries": "Surgeries",
    "hospitalizations": "Hospitalizations",
    "vision_history": "Vision History",
    "dental_history": "Dental History",
    "visit_logs": "Visit Logs",
    "vitals": "Vitals",
    "appointments": "Appointments",
    "vaccinations": "Vaccinations",
    "insurances": "Insurance",
    "pharmacies": "Pharmacies",
    "family_history": "Family History",
    "nutrition_plan": "Nutrition Plan",
}

_HIDDEN_KEYS = {"id", "created_at", "updated_at"}


def _is_hidden(key: str) -> bool:
    return key in _HIDDEN_KEYS or key.endswith("_id")


def _esc(value: object) -> str:
    if value is None:
        return ""
    return _html.escape(str(value))


def _humanize(key: str) -> str:
    return key.replace("_", " ").title()


def _render_section(section: str, rows: list[dict]) -> str:
    title = SECTION_TITLES.get(section, _humanize(section))
    if not rows:
        return f"<section><h2>{_esc(title)}</h2><p class='empty'>No records.</p></section>"
    columns = [k for k in rows[0].keys() if not _is_hidden(k)]
    head = "".join(f"<th>{_esc(_humanize(c))}</th>" for c in columns)
    body = ""
    for row in rows:
        cells = "".join(f"<td>{_esc(row.get(c))}</td>" for c in columns)
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
        _render_section(s, section_data.get(s, [])) for s in req.sections
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
