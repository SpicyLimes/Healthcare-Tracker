"""Tools the agent loop may call. Read tools run a SELECT via the existing
15-section map; draft tools (propose_record) stage values without writing; and
explicitly-allowlisted write tools (commit_create) persist via CRUDService after
the user has confirmed conversationally."""
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from app.models.audit_log import ActorType, AuditAction
from app.services import ai_write, summary_service
from app.services.audit_service import log_event
from app.services.crud_service import CRUDService

_TITLES = summary_service.SECTION_TITLES


def _section_names() -> list[str]:
    return list(summary_service.get_section_map().keys())


TOOL_DEFS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "list_sections",
            "description": "List the available patient record sections that can be queried.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_section_records",
            "description": (
                "Return all records in a patient record section, optionally filtered "
                "by created-date range (YYYY-MM-DD). Use this to ground every answer "
                "in real data. Never invent values."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "section": {"type": "string", "enum": _section_names()},
                    "date_from": {"type": "string", "description": "YYYY-MM-DD inclusive lower bound"},
                    "date_to": {"type": "string", "description": "YYYY-MM-DD inclusive upper bound"},
                },
                "required": ["section"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_record",
            "description": (
                "Draft a NEW record for the user to confirm. Does NOT save. Use after "
                "gathering the fields conversationally. Fill doctor names into the "
                "*_other free-text field (never an id)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "section": {"type": "string", "enum": ai_write.write_section_names()},
                    "fields": {"type": "object", "description": "Proposed field values."},
                },
                "required": ["section", "fields"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "commit_create",
            "description": (
                "Create a new record. Only call after the user has confirmed they "
                "want it added."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "section": {"type": "string", "enum": ai_write.write_section_names()},
                    "fields": {"type": "object", "description": "Field values for the new record."},
                },
                "required": ["section", "fields"],
            },
        },
    },
]


def _parse_date(value: Any) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return None


def _localize_datetimes(rows: list[dict], tz: str) -> list[dict]:
    """Convert any timezone-aware ISO datetime STRINGS in the rows to the given
    timezone, formatted as a clear local string. Records are stored in UTC; the
    rest of the app renders them in the user's local zone, and the model must see
    the same local times — not raw UTC — or it reports times that are hours off.

    Only full datetime strings (with a time component) are converted; plain dates
    (e.g. surgery_date) are left untouched. Anything that does not parse cleanly
    is left as-is. Never raises."""
    try:
        zone = ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError):
        return rows  # unknown tz → leave UTC rather than fail the tool

    def convert(value: Any) -> Any:
        if not isinstance(value, str) or "T" not in value:
            return value
        try:
            dt = datetime.fromisoformat(value)
        except ValueError:
            return value
        if dt.tzinfo is None:
            return value  # naive — don't guess
        local = dt.astimezone(zone)
        # Human-readable local string + zone label so the model is unambiguous.
        return local.strftime("%Y-%m-%d %H:%M") + f" ({tz})"

    return [{k: convert(v) for k, v in row.items()} for row in rows]


def dispatch(
    db: Session,
    name: str,
    args: dict,
    tz: str | None = None,
    actor_id=None,
    token_store=None,
) -> dict:
    """Execute an agent tool. Read tools and draft tools never write; create/commit
    tools write via CRUDService. Always returns a dict; never raises.

    `tz` is the IANA timezone (e.g. "America/Chicago") that datetime values should
    be presented in. When None, datetimes are left as stored (UTC).
    `actor_id` is the acting admin's user id, threaded through so writes record the
    right `created_by` and audit actor; write tools refuse if it is missing.
    `token_store` is the per-request confirmation-token store used by later
    edit/delete tools."""
    try:
        if name == "list_sections":
            return {"sections": [{"name": n, "title": _TITLES.get(n, n)} for n in _section_names()]}
        if name == "get_section_records":
            section = args.get("section")
            if section not in summary_service.get_section_map():
                return {"error": f"Unknown section '{section}'."}
            rows = summary_service.gather_section_rows(
                db, section, _parse_date(args.get("date_from")), _parse_date(args.get("date_to"))
            )
            if tz:
                rows = _localize_datetimes(rows, tz)
            return {"section": section, "count": len(rows), "records": rows}
        if name == "propose_record":
            section = args.get("section")
            fields = args.get("fields") or {}
            if section not in ai_write.WRITE_SECTION_MAP:
                return {"error": f"Section '{section}' is not writable by the assistant."}
            cleaned, warnings = ai_write.validate_fields(section, fields, mode="create")
            return {"action": "create", "section": section, "fields": cleaned, "warnings": warnings}
        if name == "commit_create":
            section = args.get("section")
            entry = ai_write.WRITE_SECTION_MAP.get(section)
            if entry is None:
                return {"error": f"Section '{section}' is not writable by the assistant."}
            if actor_id is None:
                return {"error": "Cannot create a record without an authenticated user."}
            model, create_schema, _ = entry
            cleaned, warnings = ai_write.validate_fields(section, args.get("fields") or {}, mode="create")
            try:
                validated = create_schema(**cleaned)   # enforces required fields / full-schema rules
            except Exception as exc:
                return {"error": f"Cannot create record: {exc}", "warnings": warnings}
            row = CRUDService(model).create(db, validated.model_dump(), created_by=actor_id)
            log_event(db, action=AuditAction.create, actor_type=ActorType.user,
                      actor_user_id=actor_id, section=section, record_id=str(row.id),
                      detail=f"AI created record in {section}")
            return {"created": True, "record_id": str(row.id), "section": section, "warnings": warnings}
        return {"error": f"Unknown tool '{name}'."}
    except Exception as exc:  # never leak an exception back into the loop
        return {"error": f"Tool execution failed: {exc}"}
