"""Read-only tools the agent loop may call. Each runs a SELECT via the existing
15-section map. There is NO write/delete/mutate path here by design."""
from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from app.services import summary_service

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
]


def _parse_date(value: Any) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return None


def dispatch(db: Session, name: str, args: dict) -> dict:
    """Execute a read-only tool. Always returns a dict; never raises."""
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
            return {"section": section, "count": len(rows), "records": rows}
        return {"error": f"Unknown tool '{name}'."}
    except Exception as exc:  # never leak an exception back into the loop
        return {"error": f"Tool execution failed: {exc}"}
