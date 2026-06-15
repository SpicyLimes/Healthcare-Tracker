"""Tools the agent loop may call. Read tools run a SELECT via the existing
15-section map; draft tools (propose_record) stage values without writing; and
explicitly-allowlisted write tools (commit_create) persist via CRUDService after
the user has confirmed conversationally."""
import uuid as _uuid
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit_log import ActorType, AuditAction
from app.models.notes import Note
from app.schemas.notes import NoteCreate, NotePatch, NoteResponse
from app.services import ai_write, summary_service
from app.services.audit_service import log_event
from app.services.crud_service import CRUDService

_TITLES = summary_service.SECTION_TITLES


def _section_names() -> list[str]:
    return list(summary_service.get_section_map().keys())


def _load_writable_row(db, section, record_id):
    """Return (model, row, None) or (None, None, error_str). No write."""
    entry = ai_write.WRITE_SECTION_MAP.get(section)
    if entry is None:
        return None, None, f"Section '{section}' is not writable by the assistant."
    model = entry[0]
    try:
        rid = _uuid.UUID(str(record_id))
    except (ValueError, TypeError):
        return None, None, "Invalid record id."
    row = db.get(model, rid)
    if row is None:
        return None, None, "Record not found."
    return model, row, None


def _load_note(db, note_id):
    """Return (note_row, None) or (None, error_str). No write."""
    try:
        nid = _uuid.UUID(str(note_id))
    except (ValueError, TypeError):
        return None, "Invalid note id."
    row = db.get(Note, nid)
    if row is None:
        return None, "Note not found."
    return row, None


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
            "name": "get_notes",
            "description": (
                "Return all notes and to-do items, optionally filtered by "
                "created-date range (YYYY-MM-DD) or completion status. "
                "Use this to answer questions about the patient's notes, reminders, "
                "and to-do list. Never invent values."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "date_from": {"type": "string", "description": "YYYY-MM-DD inclusive lower bound on created_at"},
                    "date_to": {"type": "string", "description": "YYYY-MM-DD inclusive upper bound on created_at"},
                    "done": {"type": "boolean", "description": "If true return only completed items; if false return only incomplete items; omit to return all"},
                    "pinned_only": {"type": "boolean", "description": "If true return only pinned notes"},
                },
                "required": [],
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
    {
        "type": "function",
        "function": {
            "name": "stage_delete",
            "description": (
                "Prepare to DELETE a record. Does NOT delete. Returns a summary to "
                "read back to the user and a confirmation token; call commit_delete "
                "only after the user confirms."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "section": {"type": "string", "enum": ai_write.write_section_names()},
                    "record_id": {"type": "string"},
                },
                "required": ["section", "record_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "stage_edit",
            "description": (
                "Prepare to EDIT a record. Does NOT save. Returns before/after and a "
                "confirmation token; call commit_edit only after the user confirms."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "section": {"type": "string", "enum": ai_write.write_section_names()},
                    "record_id": {"type": "string"},
                    "fields": {"type": "object", "description": "Field values to change."},
                },
                "required": ["section", "record_id", "fields"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "commit_delete",
            "description": (
                "Permanently delete the record that was just staged. Only call after "
                "the user confirmed the deletion you read back to them. Requires the "
                "token from stage_delete."
            ),
            "parameters": {
                "type": "object",
                "properties": {"token": {"type": "string"}},
                "required": ["token"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "commit_edit",
            "description": (
                "Apply the edit that was just staged. Only call after the user "
                "confirmed the changes you read back to them. Requires the token from "
                "stage_edit."
            ),
            "parameters": {
                "type": "object",
                "properties": {"token": {"type": "string"}},
                "required": ["token"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_note",
            "description": (
                "Draft a NEW note or to-do for the user to confirm. Does NOT save. "
                "Use after gathering the title (required) and optional body."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "body": {"type": "string"},
                    "pinned": {"type": "boolean"},
                    "done": {"type": "boolean", "description": "true marks a to-do complete"},
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "commit_create_note",
            "description": "Create a new note/to-do. Only call after the user confirmed they want it added.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "body": {"type": "string"},
                    "pinned": {"type": "boolean"},
                    "done": {"type": "boolean"},
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "stage_edit_note",
            "description": (
                "Prepare to EDIT a note/to-do. Does NOT save. Returns before/after and a "
                "confirmation token; call commit_edit_note only after the user confirms. "
                "Find the note id first with get_notes."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "note_id": {"type": "string"},
                    "fields": {"type": "object", "description": "Fields to change: title, body, pinned, done."},
                },
                "required": ["note_id", "fields"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "commit_edit_note",
            "description": "Apply the staged note edit. Requires the token from stage_edit_note.",
            "parameters": {
                "type": "object",
                "properties": {"token": {"type": "string"}},
                "required": ["token"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "stage_delete_note",
            "description": (
                "Prepare to DELETE a note/to-do. Does NOT delete. Returns a summary and a "
                "confirmation token; call commit_delete_note only after the user confirms. "
                "Find the note id first with get_notes."
            ),
            "parameters": {
                "type": "object",
                "properties": {"note_id": {"type": "string"}},
                "required": ["note_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "commit_delete_note",
            "description": "Permanently delete the staged note. Requires the token from stage_delete_note.",
            "parameters": {
                "type": "object",
                "properties": {"token": {"type": "string"}},
                "required": ["token"],
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
    `token_store` is the process-wide confirmation-token store used by later
    edit/delete tools; tokens are namespaced to `actor_id` so an admin can only
    consume their own staged action, in this or a subsequent request."""
    try:
        if name == "list_sections":
            sections = [{"name": n, "title": _TITLES.get(n, n)} for n in _section_names()]
            sections.append({"name": "notes", "title": "Notes & To-Dos"})
            return {"sections": sections}
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
        if name == "get_notes":
            date_from = _parse_date(args.get("date_from"))
            date_to = _parse_date(args.get("date_to"))
            stmt = select(Note).order_by(Note.pinned.desc(), Note.created_at.desc())
            if args.get("pinned_only"):
                stmt = stmt.where(Note.pinned.is_(True))
            if "done" in args and args["done"] is not None:
                stmt = stmt.where(Note.done.is_(args["done"]))
            all_notes = db.execute(stmt).scalars().all()
            rows = []
            for n in all_notes:
                if date_from and n.created_at.date() < date_from:
                    continue
                if date_to and n.created_at.date() > date_to:
                    continue
                rows.append(NoteResponse.model_validate(n).model_dump(mode="json"))
            if tz:
                rows = _localize_datetimes(rows, tz)
            return {"section": "notes", "count": len(rows), "records": rows}
        if name == "propose_note":
            if actor_id is None:
                return {"error": "You have read-only access and cannot add notes."}
            fields = {k: v for k, v in args.items() if k in ("title", "body", "pinned", "done") and v is not None}
            try:
                validated = NoteCreate(**fields)
            except Exception as exc:
                return {"error": f"Cannot draft note: {exc}"}
            return {"action": "create_note", "fields": validated.model_dump()}
        if name == "commit_create_note":
            if actor_id is None:
                return {"error": "Cannot create a note without an authenticated user."}
            fields = {k: v for k, v in args.items() if k in ("title", "body", "pinned", "done") and v is not None}
            try:
                validated = NoteCreate(**fields)
            except Exception as exc:
                return {"error": f"Cannot create note: {exc}"}
            note = Note(id=_uuid.uuid4(), author_user_id=actor_id, **validated.model_dump())
            db.add(note)
            db.flush()
            log_event(db, action=AuditAction.create, actor_type=ActorType.user,
                      actor_user_id=actor_id, section="notes", record_id=str(note.id),
                      detail="AI created note")
            return {"created": True, "note_id": str(note.id)}
        if name == "stage_edit_note":
            if token_store is None:
                return {"error": "No confirmation channel available."}
            if actor_id is None:
                return {"error": "Cannot edit a note without an authenticated user."}
            row, err = _load_note(db, args.get("note_id"))
            if err:
                return {"error": err}
            raw = {k: v for k, v in (args.get("fields") or {}).items()
                   if k in ("title", "body", "pinned", "done")}
            if not raw:
                return {"error": "No valid fields to edit."}
            try:
                cleaned = NotePatch(**raw).model_dump(exclude_unset=True)
            except Exception as exc:
                return {"error": f"Cannot stage note edit: {exc}"}
            if not cleaned:
                return {"error": "No valid fields to edit."}
            before = {k: getattr(row, k) for k in cleaned}
            token = token_store.stage(
                {"action": "note_edit", "note_id": str(row.id), "fields": cleaned},
                owner_id=actor_id,
            )
            return {"action": "edit_note", "note_id": str(row.id),
                    "before": before, "after": cleaned, "token": token}
        if name == "propose_record":
            if actor_id is None:
                return {"error": "You have read-only access and cannot add records."}
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
        if name == "stage_delete":
            if token_store is None:
                return {"error": "No confirmation channel available."}
            if actor_id is None:
                return {"error": "Cannot delete a record without an authenticated user."}
            _, row, err = _load_writable_row(db, args.get("section"), args.get("record_id"))
            if err:
                return {"error": err}
            summary = ai_write.row_summary(row)
            token = token_store.stage({"action": "delete", "section": args["section"], "record_id": str(row.id)}, owner_id=actor_id)
            return {"action": "delete", "section": args["section"], "record_id": str(row.id),
                    "summary": summary, "token": token}
        if name == "stage_edit":
            if token_store is None:
                return {"error": "No confirmation channel available."}
            if actor_id is None:
                return {"error": "Cannot edit a record without an authenticated user."}
            _, row, err = _load_writable_row(db, args.get("section"), args.get("record_id"))
            if err:
                return {"error": err}
            cleaned, warnings = ai_write.validate_fields(args["section"], args.get("fields") or {}, mode="update")
            if not cleaned:
                return {"error": "No valid fields to edit.", "warnings": warnings}
            before = ai_write.row_summary(row, keys=cleaned.keys())
            after = ai_write.row_summary_values(cleaned)
            token = token_store.stage({"action": "edit", "section": args["section"],
                                       "record_id": str(row.id), "fields": cleaned}, owner_id=actor_id)
            return {"action": "edit", "section": args["section"], "record_id": str(row.id),
                    "before": before, "after": after, "warnings": warnings, "token": token}
        if name in ("commit_delete", "commit_edit"):
            if token_store is None:
                return {"error": "No confirmation channel available."}
            # Consume the token FIRST (single-use, fail-closed): for the matching
            # owner the gate burns the token before any write is attempted, so no
            # token can survive a commit call. consume() returns None if the token
            # is missing, reused, expired, or owned by a different admin — every
            # refusal path below thus performs no write. (A wrong-owner attempt is
            # the one case that intentionally does NOT burn the token, so the real
            # owner can still confirm their own staged action.)
            staged = token_store.consume(args.get("token", ""), owner_id=actor_id)
            expected = "delete" if name == "commit_delete" else "edit"
            if staged is None or staged.get("action") != expected:
                return {"error": "No matching confirmation. Ask the user to confirm, then stage again."}
            entry = ai_write.WRITE_SECTION_MAP.get(staged["section"])
            if entry is None or actor_id is None:
                return {"error": "Cannot complete this action."}
            model = entry[0]
            rid = _uuid.UUID(staged["record_id"])
            service = CRUDService(model)
            if expected == "delete":
                service.delete(db, rid)
                audit_action = AuditAction.delete
            else:
                service.update(db, rid, staged["fields"])
                audit_action = AuditAction.update
            log_event(db, action=audit_action, actor_type=ActorType.user, actor_user_id=actor_id,
                      section=staged["section"], record_id=staged["record_id"],
                      detail=f"AI {expected} record in {staged['section']}")
            return {("deleted" if expected == "delete" else "updated"): True, "section": staged["section"]}
        if name in ("commit_edit_note", "commit_delete_note"):
            if token_store is None:
                return {"error": "No confirmation channel available."}
            staged = token_store.consume(args.get("token", ""), owner_id=actor_id)
            expected = "note_delete" if name == "commit_delete_note" else "note_edit"
            if staged is None or staged.get("action") != expected:
                return {"error": "No matching confirmation. Ask the user to confirm, then stage again."}
            if actor_id is None:
                return {"error": "Cannot complete this action."}
            note = db.get(Note, _uuid.UUID(staged["note_id"]))
            if note is None:
                return {"error": "Note no longer exists."}
            if expected == "note_delete":
                db.delete(note)
                db.flush()
                log_event(db, action=AuditAction.delete, actor_type=ActorType.user,
                          actor_user_id=actor_id, section="notes", record_id=staged["note_id"],
                          detail="AI deleted note")
                return {"deleted": True, "section": "notes"}
            for k, v in staged["fields"].items():
                setattr(note, k, v)
            db.flush()
            log_event(db, action=AuditAction.update, actor_type=ActorType.user,
                      actor_user_id=actor_id, section="notes", record_id=staged["note_id"],
                      detail="AI updated note")
            return {"updated": True, "section": "notes"}
        return {"error": f"Unknown tool '{name}'."}
    except Exception as exc:  # never leak an exception back into the loop
        return {"error": f"Tool execution failed: {exc}"}
