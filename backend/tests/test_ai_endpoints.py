"""AI settings + chat endpoints: auth, CSRF, 503 gating."""
from app.models.user import Role
from app.services import user_service


def _login_admin(client, db_session, email="aiadmin@example.com"):
    user_service.create_user(db_session, email, "a-strong-passphrase-123", Role.admin)
    client.post("/api/auth/login", json={"email": email, "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def _login_viewer(client, db_session, email="aiviewer@example.com"):
    user_service.create_user(db_session, email, "a-strong-passphrase-123", Role.viewer)
    client.post("/api/auth/login", json={"email": email, "password": "a-strong-passphrase-123"})
    return client.cookies.get("csrf_token")


def test_get_ai_settings_admin_returns_defaults(client, db_session):
    _login_admin(client, db_session, email="getset@example.com")
    res = client.get("/api/settings/ai")
    assert res.status_code == 200
    body = res.json()
    assert body["enabled"] is False
    assert body["base_url"] is None


def test_get_ai_settings_viewer_forbidden(client, db_session):
    _login_viewer(client, db_session, email="getsetv@example.com")
    res = client.get("/api/settings/ai")
    assert res.status_code == 403


def test_update_ai_settings_admin(client, db_session):
    csrf = _login_admin(client, db_session, email="putset@example.com")
    res = client.put(
        "/api/settings/ai",
        headers={"X-CSRF-Token": csrf},
        json={"enabled": True, "base_url": "http://localhost:1234/v1", "model": "m"},
    )
    assert res.status_code == 200
    assert res.json()["enabled"] is True
    # Confirm it actually persisted, not just echoed back.
    assert client.get("/api/settings/ai").json()["enabled"] is True


def test_update_ai_settings_partial_does_not_clobber(client, db_session):
    csrf = _login_admin(client, db_session, email="partial@example.com")
    client.put("/api/settings/ai", headers={"X-CSRF-Token": csrf},
               json={"enabled": True, "base_url": "http://localhost:1234/v1", "model": "m"})
    # Send only enabled=false; base_url/model must survive.
    res = client.put("/api/settings/ai", headers={"X-CSRF-Token": csrf}, json={"enabled": False})
    assert res.status_code == 200
    body = res.json()
    assert body["enabled"] is False
    assert body["base_url"] == "http://localhost:1234/v1"
    assert body["model"] == "m"


def test_update_ai_settings_requires_csrf(client, db_session):
    _login_admin(client, db_session, email="putcsrf@example.com")
    res = client.put("/api/settings/ai", json={"enabled": True})
    assert res.status_code == 403


def test_ai_test_unconfigured_returns_not_reachable(client, db_session):
    csrf = _login_admin(client, db_session, email="testping@example.com")
    res = client.post("/api/settings/ai/test", headers={"X-CSRF-Token": csrf})
    assert res.status_code == 200
    assert res.json()["reachable"] is False


def test_ai_test_viewer_forbidden(client, db_session):
    csrf = _login_viewer(client, db_session, email="testpingv@example.com")
    res = client.post("/api/settings/ai/test", headers={"X-CSRF-Token": csrf})
    assert res.status_code == 403


def test_chat_503_when_disabled(client, db_session):
    csrf = _login_admin(client, db_session, email="chatoff@example.com")
    res = client.post("/api/ai/chat", headers={"X-CSRF-Token": csrf},
                      json={"messages": [{"role": "user", "content": "hi"}]})
    assert res.status_code == 503


def test_ai_status_viewer_allowed_no_base_url(client, db_session):
    """Viewers can read AI status; it must expose enabled+model but never base_url."""
    admin_csrf = _login_admin(client, db_session, email="statusadmin@example.com")
    client.put("/api/settings/ai", headers={"X-CSRF-Token": admin_csrf},
               json={"enabled": True, "base_url": "http://secret-host/v1", "model": "m"})
    _login_viewer(client, db_session, email="statusviewer@example.com")
    res = client.get("/api/ai/status")
    assert res.status_code == 200
    body = res.json()
    assert body == {"enabled": True, "model": "m"}
    assert "base_url" not in body


def test_ai_status_unauthenticated(client, db_session):
    res = client.get("/api/ai/status")
    assert res.status_code == 401


def test_chat_viewer_gets_503_when_disabled(client, db_session):
    csrf = _login_viewer(client, db_session, email="chatviewer@example.com")
    res = client.post("/api/ai/chat", headers={"X-CSRF-Token": csrf},
                      json={"messages": [{"role": "user", "content": "hi"}]})
    # Viewers are now allowed; unconfigured AI returns 503, not 403.
    assert res.status_code == 503


def test_chat_viewer_read_only_succeeds(client, db_session, monkeypatch):
    from app.services import ai_provider
    # Viewers can't access settings, so enable AI via admin first.
    admin_csrf = _login_admin(client, db_session, email="chatvieweradmin@example.com")
    client.put("/api/settings/ai", headers={"X-CSRF-Token": admin_csrf},
               json={"enabled": True, "base_url": "http://x/v1", "model": "m"})
    # Now log in as the viewer (replaces the admin session).
    _login_viewer(client, db_session, email="chatviewerok@example.com")
    csrf = client.cookies.get("csrf_token")
    monkeypatch.setattr(ai_provider, "chat_completion",
        lambda *a, **k: {"message": {"role": "assistant", "content": "I can read records.", "tool_calls": None}})
    res = client.post("/api/ai/chat", headers={"X-CSRF-Token": csrf},
                      json={"messages": [{"role": "user", "content": "what meds do I take?"}]})
    assert res.status_code == 200
    assert res.json()["answer"] == "I can read records."


def test_chat_viewer_commit_create_writes_no_row(client, db_session, monkeypatch):
    """A viewer driving commit_create must NOT create a row — assert at the DB level,
    not just that the request returned 200 (a successful write also returns 200)."""
    import json as _json
    from app.services import ai_provider
    from app.models.extended_records import Surgery
    admin_csrf = _login_admin(client, db_session, email="vcreateadmin@example.com")
    client.put("/api/settings/ai", headers={"X-CSRF-Token": admin_csrf},
               json={"enabled": True, "base_url": "http://x/v1", "model": "m"})
    _login_viewer(client, db_session, email="vcreate@example.com")
    csrf = client.cookies.get("csrf_token")
    before = db_session.query(Surgery).count()
    calls = {"n": 0}
    def fake(base_url, model, messages, tools):
        calls["n"] += 1
        if calls["n"] == 1:
            return {"message": {"role": "assistant", "content": None, "tool_calls": [
                {"id": "c1", "type": "function", "function": {
                    "name": "commit_create",
                    "arguments": _json.dumps({"section": "surgeries", "fields": {"procedure": "X"}})}}]}}
        last_tool = next((m for m in reversed(messages) if m.get("role") == "tool"), None)
        assert last_tool is not None and "error" in _json.loads(last_tool["content"])
        return {"message": {"role": "assistant", "content": "Cannot write.", "tool_calls": None}}
    monkeypatch.setattr(ai_provider, "chat_completion", fake)
    res = client.post("/api/ai/chat", headers={"X-CSRF-Token": csrf},
                      json={"messages": [{"role": "user", "content": "add a surgery"}]})
    assert res.status_code == 200
    db_session.expire_all()
    assert db_session.query(Surgery).count() == before     # no row created


def test_chat_viewer_delete_flow_deletes_nothing(client, db_session, monkeypatch):
    """A viewer driving stage_delete -> commit_delete must NOT delete the row.
    Covers the token path the create-only test missed."""
    import json as _json
    from app.services import ai_provider
    from app.services.crud_service import CRUDService
    from app.models.extended_records import Surgery
    from app.models.user import User
    admin_csrf = _login_admin(client, db_session, email="vdeladmin@example.com")
    client.put("/api/settings/ai", headers={"X-CSRF-Token": admin_csrf},
               json={"enabled": True, "base_url": "http://x/v1", "model": "m"})
    admin = db_session.query(User).filter_by(email="vdeladmin@example.com").first()
    row = CRUDService(Surgery).create(db_session, {"procedure": "KeepMe"}, created_by=admin.id)
    db_session.commit()
    rid = row.id

    _login_viewer(client, db_session, email="vdel@example.com")
    csrf = client.cookies.get("csrf_token")
    def fake(base_url, model, messages, tools):
        # If stage_delete is (incorrectly) allowed, it would return a token; the model
        # would then call commit_delete. We always try to stage+commit so a regression
        # that re-opens either step would actually delete the row.
        if not any(m.get("role") == "tool" for m in messages):
            return {"message": {"role": "assistant", "content": None, "tool_calls": [
                {"id": "c1", "type": "function", "function": {"name": "stage_delete",
                 "arguments": _json.dumps({"section": "surgeries", "record_id": str(rid)})}}]}}
        last_tool = next((m for m in reversed(messages) if m.get("role") == "tool"), None)
        payload = _json.loads(last_tool["content"])
        if "token" in payload:   # only reachable if stage_delete wrongly succeeded
            return {"message": {"role": "assistant", "content": None, "tool_calls": [
                {"id": "c2", "type": "function", "function": {"name": "commit_delete",
                 "arguments": _json.dumps({"token": payload["token"]})}}]}}
        return {"message": {"role": "assistant", "content": "Cannot delete.", "tool_calls": None}}
    monkeypatch.setattr(ai_provider, "chat_completion", fake)
    res = client.post("/api/ai/chat", headers={"X-CSRF-Token": csrf},
                      json={"messages": [{"role": "user", "content": "delete the surgery"}]})
    assert res.status_code == 200
    db_session.expire_all()
    assert db_session.get(Surgery, rid) is not None        # row survived


def test_chat_requires_csrf(client, db_session):
    _login_admin(client, db_session, email="chatcsrf@example.com")
    res = client.post("/api/ai/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert res.status_code == 403


def test_chat_happy_path_logs_ai_query(client, db_session, monkeypatch):
    from app.models.audit_log import AuditAction, AuditLog
    from app.services import ai_provider
    csrf = _login_admin(client, db_session, email="chatok@example.com")
    client.put("/api/settings/ai", headers={"X-CSRF-Token": csrf},
               json={"enabled": True, "base_url": "http://x/v1", "model": "m"})

    def fake_completion(base_url, model, messages, tools):
        return {"message": {"role": "assistant", "content": "Hello from AI.", "tool_calls": None}}

    monkeypatch.setattr(ai_provider, "chat_completion", fake_completion)
    res = client.post("/api/ai/chat", headers={"X-CSRF-Token": csrf},
                      json={"messages": [{"role": "user", "content": "what meds?"}]})
    assert res.status_code == 200
    assert res.json()["answer"] == "Hello from AI."
    logged = db_session.query(AuditLog).filter(AuditLog.action == AuditAction.ai_query).all()
    assert len(logged) >= 1
    assert "what meds?" in (logged[-1].detail or "")
    # The answer is logged too, not just the question.
    assert logged[-1].ai_response == "Hello from AI."


def test_chat_logs_truncate_long_answers(client, db_session, monkeypatch):
    """Answers are unbounded; the audit row must stay clipped like the question."""
    from app.models.audit_log import AuditAction, AuditLog
    from app.routers.ai import AUDIT_TEXT_LIMIT
    from app.services import ai_provider
    csrf = _login_admin(client, db_session, email="chatlong@example.com")
    client.put("/api/settings/ai", headers={"X-CSRF-Token": csrf},
               json={"enabled": True, "base_url": "http://x/v1", "model": "m"})

    long_answer = "A" * 5000

    def fake_completion(base_url, model, messages, tools):
        return {"message": {"role": "assistant", "content": long_answer, "tool_calls": None}}

    monkeypatch.setattr(ai_provider, "chat_completion", fake_completion)
    res = client.post("/api/ai/chat", headers={"X-CSRF-Token": csrf},
                      json={"messages": [{"role": "user", "content": "tell me everything"}]})
    assert res.status_code == 200
    # The caller still gets the full answer — only the audit copy is clipped.
    assert res.json()["answer"] == long_answer

    logged = db_session.query(AuditLog).filter(AuditLog.action == AuditAction.ai_query).all()
    stored = logged[-1].ai_response
    assert stored is not None
    assert len(stored) == AUDIT_TEXT_LIMIT + 1      # +1 for the ellipsis
    assert stored.endswith("…")


def test_non_ai_actions_have_no_ai_response(client, db_session):
    """ai_response must stay null for everything that is not an AI query."""
    from app.models.audit_log import AuditAction, AuditLog
    _login_admin(client, db_session, email="chatnull@example.com")
    logins = db_session.query(AuditLog).filter(AuditLog.action == AuditAction.login).all()
    assert len(logins) >= 1
    assert all(e.ai_response is None for e in logins)


def test_chat_provider_unavailable_returns_503(client, db_session, monkeypatch):
    from app.services import ai_provider
    csrf = _login_admin(client, db_session, email="chatdown@example.com")
    client.put("/api/settings/ai", headers={"X-CSRF-Token": csrf},
               json={"enabled": True, "base_url": "http://x/v1", "model": "m"})

    def boom(base_url, model, messages, tools):
        raise ai_provider.ProviderUnavailable("down")

    monkeypatch.setattr(ai_provider, "chat_completion", boom)
    res = client.post("/api/ai/chat", headers={"X-CSRF-Token": csrf},
                      json={"messages": [{"role": "user", "content": "hi"}]})
    assert res.status_code == 503


def test_get_ai_settings_unauthenticated(client, db_session):
    res = client.get("/api/settings/ai")
    assert res.status_code == 401


def test_chat_unauthenticated(client, db_session):
    res = client.post("/api/ai/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert res.status_code == 401


def test_chat_response_defaults_proposals_empty():
    from app.schemas.ai import ChatResponse
    r = ChatResponse(answer="hi", tools_used=[])
    assert r.proposals == []


def test_proposal_model_shape():
    from app.schemas.ai import Proposal
    p = Proposal(action="create", section="surgeries", fields={"procedure": "X"}, warnings=[])
    assert p.action == "create"
    assert p.record_id is None


def test_chat_endpoint_surfaces_proposals(client, db_session, monkeypatch):
    import json
    from app.services import ai_provider
    csrf = _login_admin(client, db_session, email="chatprop@example.com")
    client.put("/api/settings/ai", headers={"X-CSRF-Token": csrf},
               json={"enabled": True, "base_url": "http://x/v1", "model": "m"})
    calls = {"n": 0}
    def fake(base_url, model, messages, tools):
        calls["n"] += 1
        if calls["n"] == 1:
            return {"message": {"role": "assistant", "content": None, "tool_calls": [
                {"id": "c1", "type": "function", "function": {
                    "name": "propose_record",
                    "arguments": json.dumps({"section": "surgeries", "fields": {"procedure": "Appendectomy"}})}}]}}
        return {"message": {"role": "assistant", "content": "I'll add it. Confirm?", "tool_calls": None}}
    monkeypatch.setattr(ai_provider, "chat_completion", fake)
    res = client.post("/api/ai/chat", headers={"X-CSRF-Token": csrf},
                      json={"messages": [{"role": "user", "content": "she had an appendectomy"}]})
    assert res.status_code == 200
    body = res.json()
    assert "proposals" in body
    assert len(body["proposals"]) == 1
    assert body["proposals"][0]["section"] == "surgeries"
    assert body["proposals"][0]["action"] == "create"
    assert body["proposals"][0]["fields"]["procedure"] == "Appendectomy"


def test_chat_endpoint_plain_qa_empty_proposals(client, db_session, monkeypatch):
    from app.services import ai_provider
    csrf = _login_admin(client, db_session, email="chatqa@example.com")
    client.put("/api/settings/ai", headers={"X-CSRF-Token": csrf},
               json={"enabled": True, "base_url": "http://x/v1", "model": "m"})
    monkeypatch.setattr(ai_provider, "chat_completion",
        lambda *a, **k: {"message": {"role": "assistant", "content": "You have 2 meds.", "tool_calls": None}})
    res = client.post("/api/ai/chat", headers={"X-CSRF-Token": csrf},
                      json={"messages": [{"role": "user", "content": "how many meds?"}]})
    assert res.status_code == 200
    assert res.json()["proposals"] == []


def test_edit_gate_survives_across_two_requests(client, db_session, monkeypatch):
    """stage in request 1, confirm 'yes' in request 2 -> the write happens.
    This is the cross-request flow the per-request store could not do."""
    import json
    from app.services import ai_provider, user_service
    from app.services.crud_service import CRUDService
    from app.models.user import Role
    from app.models.extended_records import Surgery
    csrf = _login_admin(client, db_session, email="gateadmin@example.com")
    client.put("/api/settings/ai", headers={"X-CSRF-Token": csrf},
               json={"enabled": True, "base_url": "http://x/v1", "model": "m"})
    # make a surgery to edit
    admin = db_session.query(__import__("app.models.user", fromlist=["User"]).User).filter_by(email="gateadmin@example.com").first()
    row = CRUDService(Surgery).create(db_session, {"procedure": "Old"}, created_by=admin.id)
    db_session.commit()

    # request 1: model stages an edit
    def fake_stage(base_url, model, messages, tools):
        # one tool round: stage_edit, then a text answer reading the summary back
        if not any(m.get("role") == "tool" for m in messages):
            return {"message": {"role": "assistant", "content": None, "tool_calls": [
                {"id": "c1", "type": "function", "function": {"name": "stage_edit",
                 "arguments": json.dumps({"section": "surgeries", "record_id": str(row.id),
                                          "fields": {"procedure": "New"}})}}]}}
        return {"message": {"role": "assistant", "content": "Change procedure Old -> New. Confirm?", "tool_calls": None}}
    monkeypatch.setattr(ai_provider, "chat_completion", fake_stage)
    r1 = client.post("/api/ai/chat", headers={"X-CSRF-Token": csrf},
                     json={"messages": [{"role": "user", "content": "change the surgery procedure to New"}]})
    assert r1.status_code == 200
    assert len(r1.json()["proposals"]) == 1
    # the model knows the token from the tool result in request 1's loop; capture it for request 2.
    # Since the token isn't exposed to the client, the SECOND request's model must call commit_edit
    # with the token it saw. We simulate that by having the model echo the staged token.
    # Grab the token from the singleton store for THIS admin to drive the commit call deterministically.
    from app.services import ai_write
    # find the staged token for this admin
    staged_tokens = [t for t, (_, owner, act) in ai_write.get_token_store()._staged.items() if owner == str(admin.id)]
    assert len(staged_tokens) == 1
    tok = staged_tokens[0]

    # request 2: user says yes -> model calls commit_edit with the token
    def fake_commit(base_url, model, messages, tools):
        if not any(m.get("role") == "tool" for m in messages):
            return {"message": {"role": "assistant", "content": None, "tool_calls": [
                {"id": "c2", "type": "function", "function": {"name": "commit_edit",
                 "arguments": json.dumps({"token": tok})}}]}}
        return {"message": {"role": "assistant", "content": "Done — updated.", "tool_calls": None}}
    monkeypatch.setattr(ai_provider, "chat_completion", fake_commit)
    r2 = client.post("/api/ai/chat", headers={"X-CSRF-Token": csrf},
                     json={"messages": [{"role": "user", "content": "yes"}]})
    assert r2.status_code == 200
    db_session.expire_all()
    assert db_session.get(Surgery, row.id).procedure == "New"      # the cross-request write happened
