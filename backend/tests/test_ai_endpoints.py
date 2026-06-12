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


def test_chat_viewer_forbidden(client, db_session):
    csrf = _login_viewer(client, db_session, email="chatviewer@example.com")
    res = client.post("/api/ai/chat", headers={"X-CSRF-Token": csrf},
                      json={"messages": [{"role": "user", "content": "hi"}]})
    assert res.status_code == 403


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
