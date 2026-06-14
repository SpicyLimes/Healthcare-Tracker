"""ai_tools: read-only tool defs + dispatch over the section map."""
import uuid as _uuid

from app.models.user import Role
from app.services import ai_tools, user_service


def test_tool_defs_are_read_only_and_well_formed():
    # Safety invariant: most tools are read/draft and never touch the DB. Some
    # record-management tools carry a mutate-keyword in their NAME, but that does
    # NOT mean they write: draft tools (propose_/stage_) only stage values or mint
    # a confirmation token; only commit_ tools actually write, and they are token-
    # /confirmation-gated (enforced in the next task). This invariant therefore
    # distinguishes DRAFT-but-keyword-named tools from real WRITE tools by name.
    defs = ai_tools.TOOL_DEFS
    names = {d["function"]["name"] for d in defs}
    assert names == {
        "list_sections", "get_section_records", "get_notes", "propose_record",
        "commit_create", "stage_edit", "stage_delete",
        "commit_edit", "commit_delete",
    }
    # Invariant: the ONLY tools that may carry a mutate-keyword in their name are
    # the explicit record-management flow tools. Of those, stage_/propose_ tools
    # DRAFT (no DB write); only commit_ tools write, and they are confirmation-gated.
    _DRAFT_TOOLS = {"propose_record", "stage_edit", "stage_delete"}   # no DB write
    _WRITE_TOOLS = {"commit_create", "commit_edit", "commit_delete"}
    _ALLOWED_MUTATING_NAMES = _DRAFT_TOOLS | _WRITE_TOOLS
    _MUTATE_KEYWORDS = ("create", "update", "delete", "write", "add", "remove",
                        "insert", "patch", "put", "set", "upsert", "edit")
    for d in defs:
        n = d["function"]["name"]
        if any(kw in n for kw in _MUTATE_KEYWORDS):
            assert n in _ALLOWED_MUTATING_NAMES, f"unexpected mutating-named tool: {n}"
    # keep the section-enum sanity check
    grec = next(d for d in defs if d["function"]["name"] == "get_section_records")
    section_enum = grec["function"]["parameters"]["properties"]["section"]["enum"]
    assert "doctors" in section_enum and "medications" in section_enum
    assert len(section_enum) == 15


def test_dispatch_list_sections(db_session):
    result = ai_tools.dispatch(db_session, "list_sections", {})
    names = {s["name"] for s in result["sections"]}
    assert "doctors" in names
    assert "notes" in names                    # Notes & To-Dos surfaced for the AI
    assert len(names) == 16                     # 15 record sections + notes
    # every section entry carries a non-empty human title
    assert all("title" in s and s["title"] for s in result["sections"])


def test_dispatch_get_section_records_returns_rows(client, db_session):
    user_service.create_user(db_session, "tooladmin@example.com", "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": "tooladmin@example.com", "password": "a-strong-passphrase-123"})
    csrf = client.cookies.get("csrf_token")
    client.post("/api/doctors", headers={"X-CSRF-Token": csrf}, json={"name": "Dr. Tool Test"})

    result = ai_tools.dispatch(db_session, "get_section_records", {"section": "doctors"})
    assert result["section"] == "doctors"
    assert any(r.get("name") == "Dr. Tool Test" for r in result["records"])
    assert result["count"] >= 1
    assert result["count"] == len(result["records"])


def test_dispatch_get_section_records_date_filter_parses(client, db_session):
    # invalid date strings must not raise — they should be treated as no filter
    result = ai_tools.dispatch(db_session, "get_section_records",
                               {"section": "doctors", "date_from": "not-a-date"})
    assert "records" in result


def test_dispatch_unknown_section_returns_error_not_raises(db_session):
    result = ai_tools.dispatch(db_session, "get_section_records", {"section": "nope"})
    assert "error" in result


def test_dispatch_unknown_tool_returns_error_not_raises(db_session):
    result = ai_tools.dispatch(db_session, "delete_everything", {})
    assert "error" in result


def test_dispatch_converts_datetimes_to_admin_timezone(client, db_session):
    """Appointment stored in UTC must be presented to the model in the admin's
    local timezone — not raw UTC — so the model reports the correct local time."""
    from datetime import datetime, timezone
    from app.models.extended_records import Appointment
    from app.models.user import Role
    from app.services import user_service

    admin = user_service.create_user(
        db_session, "tzadmin@example.com", "a-strong-passphrase-123", Role.admin
    )
    # 14:45 UTC on 2026-06-22. In America/Chicago (CDT, UTC-5 in June) this is 09:45.
    appt = Appointment(
        appointment_datetime=datetime(2026, 6, 22, 14, 45, tzinfo=timezone.utc),
        reason="Follow-up",
        created_by=admin.id,
    )
    db_session.add(appt)
    db_session.flush()

    result = ai_tools.dispatch(
        db_session, "get_section_records", {"section": "appointments"}, tz="America/Chicago"
    )
    row = next(r for r in result["records"] if r.get("reason") == "Follow-up")
    dt_str = str(row["appointment_datetime"])
    # Local time must appear; raw UTC 14:45 must not be what the model sees.
    assert "09:45" in dt_str
    assert "14:45" not in dt_str


def test_dispatch_without_tz_leaves_datetimes_as_is(client, db_session):
    """Backward-compatible: no tz passed → existing behavior (no conversion)."""
    from datetime import datetime, timezone
    from app.models.extended_records import Appointment
    from app.models.user import Role
    from app.services import user_service

    admin = user_service.create_user(
        db_session, "notzadmin@example.com", "a-strong-passphrase-123", Role.admin
    )
    appt = Appointment(
        appointment_datetime=datetime(2026, 6, 22, 14, 45, tzinfo=timezone.utc),
        reason="NoTz",
        created_by=admin.id,
    )
    db_session.add(appt)
    db_session.flush()

    result = ai_tools.dispatch(db_session, "get_section_records", {"section": "appointments"})
    row = next(r for r in result["records"] if r.get("reason") == "NoTz")
    assert "14:45" in str(row["appointment_datetime"])


def test_propose_record_returns_draft_no_write(db_session):
    from app.services import ai_tools
    from app.models.extended_records import Surgery
    before = db_session.query(Surgery).count()
    result = ai_tools.dispatch(
        db_session, "propose_record",
        {"section": "surgeries", "fields": {"procedure": "Appendectomy", "surgery_date": "2026-06-04"}},
        actor_id=_uuid.uuid4(),
    )
    assert result["action"] == "create"
    assert result["section"] == "surgeries"
    assert result["fields"]["procedure"] == "Appendectomy"
    assert db_session.query(Surgery).count() == before     # NOTHING written


def test_propose_record_bad_date_warns(db_session):
    from app.services import ai_tools
    result = ai_tools.dispatch(
        db_session, "propose_record",
        {"section": "surgeries", "fields": {"procedure": "X", "surgery_date": "nope"}},
        actor_id=_uuid.uuid4(),
    )
    assert any("surgery_date" in w for w in result["warnings"])


def test_propose_record_unknown_section(db_session):
    from app.services import ai_tools
    result = ai_tools.dispatch(db_session, "propose_record", {"section": "profile", "fields": {}},
                               actor_id=_uuid.uuid4())
    assert "error" in result


def test_propose_record_refuses_viewer(db_session):
    # actor_id=None (a viewer) must not even draft a create.
    from app.services import ai_tools
    result = ai_tools.dispatch(
        db_session, "propose_record",
        {"section": "surgeries", "fields": {"procedure": "X"}},
        actor_id=None,
    )
    assert "error" in result
    assert "read-only" in result["error"].lower()


def test_commit_create_writes_and_audits(db_session):
    from app.services import ai_tools, user_service
    from app.models.user import Role
    from app.models.extended_records import Surgery
    admin = user_service.create_user(db_session, "writeadmin@example.com", "a-strong-passphrase-123", Role.admin)
    db_session.flush()
    before = db_session.query(Surgery).count()
    result = ai_tools.dispatch(
        db_session, "commit_create",
        {"section": "surgeries", "fields": {"procedure": "Appendectomy"}},
        actor_id=admin.id,
    )
    assert result["created"] is True
    assert "record_id" in result
    assert db_session.query(Surgery).count() == before + 1

    from app.models.audit_log import AuditLog, AuditAction
    audit = db_session.query(AuditLog).filter_by(
        record_id=result["record_id"], action=AuditAction.create
    ).all()
    assert len(audit) == 1
    assert audit[0].actor_user_id == admin.id


def test_commit_create_missing_required_field_no_write(db_session):
    from app.services import ai_tools, user_service
    from app.models.user import Role
    from app.models.extended_records import Surgery
    admin = user_service.create_user(db_session, "reqadmin@example.com", "a-strong-passphrase-123", Role.admin)
    db_session.flush()
    before = db_session.query(Surgery).count()
    # Surgery requires `procedure`; omit it
    result = ai_tools.dispatch(db_session, "commit_create",
        {"section": "surgeries", "fields": {"hospital": "General"}}, actor_id=admin.id)
    assert "error" in result
    assert db_session.query(Surgery).count() == before


def test_commit_create_unknown_section_no_write(db_session):
    from app.services import ai_tools, user_service
    from app.models.user import Role
    admin = user_service.create_user(db_session, "writeadmin2@example.com", "a-strong-passphrase-123", Role.admin)
    db_session.flush()
    result = ai_tools.dispatch(
        db_session, "commit_create",
        {"section": "profile", "fields": {}}, actor_id=admin.id,
    )
    assert "error" in result


def test_commit_create_without_actor_no_write(db_session):
    from app.services import ai_tools
    from app.models.extended_records import Surgery
    before = db_session.query(Surgery).count()
    result = ai_tools.dispatch(db_session, "commit_create",
        {"section": "surgeries", "fields": {"procedure": "X"}}, actor_id=None)
    assert "error" in result
    assert db_session.query(Surgery).count() == before


def _make_surgery_for_stage(db_session):
    from app.services import user_service
    from app.models.user import Role
    from app.services.crud_service import CRUDService
    from app.models.extended_records import Surgery
    admin = user_service.create_user(db_session, f"stage{id(db_session)}@example.com", "a-strong-passphrase-123", Role.admin)
    db_session.flush()
    row = CRUDService(Surgery).create(db_session, {"procedure": "Old"}, created_by=admin.id)
    db_session.flush()
    return admin, row


def test_stage_delete_returns_token_no_write(db_session):
    from app.services import ai_tools
    from app.services.ai_write import TokenStore
    from app.models.extended_records import Surgery
    admin, row = _make_surgery_for_stage(db_session)
    store = TokenStore()
    before = db_session.query(Surgery).count()
    result = ai_tools.dispatch(db_session, "stage_delete",
        {"section": "surgeries", "record_id": str(row.id)},
        token_store=store, actor_id=admin.id)
    assert result["action"] == "delete"
    assert result["token"]
    assert "Old" in str(result["summary"])
    assert db_session.query(Surgery).count() == before     # NO write


def test_stage_edit_returns_before_and_token(db_session):
    from app.services import ai_tools
    from app.services.ai_write import TokenStore
    admin, row = _make_surgery_for_stage(db_session)
    store = TokenStore()
    result = ai_tools.dispatch(db_session, "stage_edit",
        {"section": "surgeries", "record_id": str(row.id), "fields": {"procedure": "New"}},
        token_store=store, actor_id=admin.id)
    assert result["before"]["procedure"] == "Old"
    assert result["after"]["procedure"] == "New"
    assert result["token"]


def test_stage_delete_missing_record(db_session):
    from app.services import ai_tools
    from app.services.ai_write import TokenStore
    result = ai_tools.dispatch(db_session, "stage_delete",
        {"section": "surgeries", "record_id": "00000000-0000-0000-0000-000000000000"},
        token_store=TokenStore(), actor_id=None)
    assert "error" in result


def test_stage_edit_invalid_record_id(db_session):
    from app.services import ai_tools
    from app.services.ai_write import TokenStore
    result = ai_tools.dispatch(db_session, "stage_edit",
        {"section": "surgeries", "record_id": "not-a-uuid", "fields": {"procedure": "New"}},
        token_store=TokenStore(), actor_id=None)
    assert "error" in result


def test_stage_edit_empty_fields_no_token(db_session):
    from app.services import ai_tools
    from app.services.ai_write import TokenStore
    admin, row = _make_surgery_for_stage(db_session)
    store = TokenStore()
    # only an unknown field → cleaned is empty → must NOT stage a token
    result = ai_tools.dispatch(db_session, "stage_edit",
        {"section": "surgeries", "record_id": str(row.id), "fields": {"bogus_field": "x"}},
        token_store=store, actor_id=admin.id)
    assert "error" in result
    assert "token" not in result


def test_stage_delete_requires_token_store(db_session):
    from app.services import ai_tools
    admin, row = _make_surgery_for_stage(db_session)
    result = ai_tools.dispatch(db_session, "stage_delete",
        {"section": "surgeries", "record_id": str(row.id)},
        token_store=None, actor_id=admin.id)
    assert "error" in result


def test_stage_edit_read_only_section_rejected(db_session):
    from app.services import ai_tools
    from app.services.ai_write import TokenStore
    # 'profile' is intentionally NOT writable by the AI
    result = ai_tools.dispatch(db_session, "stage_edit",
        {"section": "profile", "record_id": "00000000-0000-0000-0000-000000000000", "fields": {"x": 1}},
        token_store=TokenStore(), actor_id=None)
    assert "error" in result
    assert "token" not in result


def test_commit_delete_with_valid_token_writes(db_session):
    from app.services import ai_tools
    from app.services.ai_write import TokenStore
    from app.models.extended_records import Surgery
    admin, row = _make_surgery_for_stage(db_session)
    store = TokenStore()
    staged = ai_tools.dispatch(db_session, "stage_delete",
        {"section": "surgeries", "record_id": str(row.id)}, token_store=store, actor_id=admin.id)
    result = ai_tools.dispatch(db_session, "commit_delete",
        {"token": staged["token"]}, token_store=store, actor_id=admin.id)
    assert result["deleted"] is True
    assert db_session.get(Surgery, row.id) is None


def test_commit_delete_without_token_refused_no_write(db_session):
    from app.services import ai_tools
    from app.services.ai_write import TokenStore
    from app.models.extended_records import Surgery
    admin, row = _make_surgery_for_stage(db_session)
    result = ai_tools.dispatch(db_session, "commit_delete",
        {"token": "fabricated"}, token_store=TokenStore(), actor_id=admin.id)
    assert "error" in result
    assert db_session.get(Surgery, row.id) is not None     # STILL THERE


def test_commit_delete_reused_token_refused(db_session):
    from app.services import ai_tools
    from app.services.ai_write import TokenStore
    admin, row = _make_surgery_for_stage(db_session)
    store = TokenStore()
    staged = ai_tools.dispatch(db_session, "stage_delete",
        {"section": "surgeries", "record_id": str(row.id)}, token_store=store, actor_id=admin.id)
    ai_tools.dispatch(db_session, "commit_delete", {"token": staged["token"]}, token_store=store, actor_id=admin.id)
    second = ai_tools.dispatch(db_session, "commit_delete", {"token": staged["token"]}, token_store=store, actor_id=admin.id)
    assert "error" in second


def test_commit_delete_wrong_action_token_refused(db_session):
    # an EDIT token must not drive a delete
    from app.services import ai_tools
    from app.services.ai_write import TokenStore
    from app.models.extended_records import Surgery
    admin, row = _make_surgery_for_stage(db_session)
    store = TokenStore()
    staged = ai_tools.dispatch(db_session, "stage_edit",
        {"section": "surgeries", "record_id": str(row.id), "fields": {"procedure": "New"}},
        token_store=store, actor_id=admin.id)
    result = ai_tools.dispatch(db_session, "commit_delete",
        {"token": staged["token"]}, token_store=store, actor_id=admin.id)
    assert "error" in result
    assert db_session.get(Surgery, row.id) is not None


def test_commit_edit_with_valid_token_writes(db_session):
    from app.services import ai_tools
    from app.services.ai_write import TokenStore
    from app.models.extended_records import Surgery
    admin, row = _make_surgery_for_stage(db_session)
    store = TokenStore()
    staged = ai_tools.dispatch(db_session, "stage_edit",
        {"section": "surgeries", "record_id": str(row.id), "fields": {"procedure": "New"}},
        token_store=store, actor_id=admin.id)
    result = ai_tools.dispatch(db_session, "commit_edit", {"token": staged["token"]}, token_store=store, actor_id=admin.id)
    assert result["updated"] is True
    db_session.expire_all()
    assert db_session.get(Surgery, row.id).procedure == "New"


def test_commit_edit_no_token_store_refused(db_session):
    from app.services import ai_tools
    result = ai_tools.dispatch(db_session, "commit_edit", {"token": "x"}, token_store=None, actor_id=None)
    assert "error" in result


def test_commit_delete_expired_token_refused_no_write(db_session):
    from app.services import ai_tools
    from app.services.ai_write import TokenStore
    from app.models.extended_records import Surgery
    admin, row = _make_surgery_for_stage(db_session)
    store = TokenStore(ttl_seconds=0)          # token expires immediately
    staged = ai_tools.dispatch(db_session, "stage_delete",
        {"section": "surgeries", "record_id": str(row.id)}, token_store=store, actor_id=admin.id)
    result = ai_tools.dispatch(db_session, "commit_delete",
        {"token": staged["token"]}, token_store=store, actor_id=admin.id)
    assert "error" in result
    assert db_session.get(Surgery, row.id) is not None     # expired → NO delete


def test_commit_edit_on_deleted_row_errors_no_crash(db_session):
    from app.services import ai_tools
    from app.services.ai_write import TokenStore
    from app.services.crud_service import CRUDService
    from app.models.extended_records import Surgery
    admin, row = _make_surgery_for_stage(db_session)
    store = TokenStore()
    staged = ai_tools.dispatch(db_session, "stage_edit",
        {"section": "surgeries", "record_id": str(row.id), "fields": {"procedure": "New"}},
        token_store=store, actor_id=admin.id)
    # delete the row out-of-band AFTER staging
    CRUDService(Surgery).delete(db_session, row.id)
    db_session.flush()
    result = ai_tools.dispatch(db_session, "commit_edit",
        {"token": staged["token"]}, token_store=store, actor_id=admin.id)
    assert "error" in result                   # graceful, no crash
