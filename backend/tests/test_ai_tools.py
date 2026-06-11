"""ai_tools: read-only tool defs + dispatch over the section map."""
from app.models.user import Role
from app.services import ai_tools, user_service


def test_tool_defs_are_read_only_and_well_formed():
    defs = ai_tools.TOOL_DEFS
    names = {d["function"]["name"] for d in defs}
    assert names == {"list_sections", "get_section_records"}
    # No write/delete/mutate tool may ever exist.
    _MUTATE_KEYWORDS = (
        "create", "update", "delete", "write", "add", "remove",
        "insert", "patch", "put", "set", "upsert", "edit",
    )
    for d in defs:
        n = d["function"]["name"]
        assert not any(kw in n for kw in _MUTATE_KEYWORDS)
    # section arg is enum-constrained to the known section map
    grec = next(d for d in defs if d["function"]["name"] == "get_section_records")
    section_enum = grec["function"]["parameters"]["properties"]["section"]["enum"]
    assert "doctors" in section_enum and "medications" in section_enum
    assert len(section_enum) == 15


def test_dispatch_list_sections(db_session):
    result = ai_tools.dispatch(db_session, "list_sections", {})
    names = {s["name"] for s in result["sections"]}
    assert "doctors" in names
    assert len(names) == 15
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
