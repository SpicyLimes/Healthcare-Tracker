"""ai_agent loop: tool round-trips, bounded rounds, grounding."""
from app.services import ai_agent, ai_provider


class _FakeSettings:
    base_url = "http://x/v1"
    model = "m"


def test_agent_returns_direct_answer(monkeypatch, db_session):
    def fake_completion(base_url, model, messages, tools):
        return {"message": {"role": "assistant", "content": "Direct answer.", "tool_calls": None}}

    monkeypatch.setattr(ai_provider, "chat_completion", fake_completion)
    res = ai_agent.run_chat(db_session, _FakeSettings(), [{"role": "user", "content": "hi"}])
    assert res.answer == "Direct answer."
    assert res.tools_used == []


def test_agent_runs_one_tool_round_then_answers(monkeypatch, db_session):
    calls = {"n": 0}

    def fake_completion(base_url, model, messages, tools):
        calls["n"] += 1
        if calls["n"] == 1:
            return {"message": {"role": "assistant", "content": None, "tool_calls": [
                {"id": "c1", "type": "function",
                 "function": {"name": "list_sections", "arguments": "{}"}}
            ]}}
        return {"message": {"role": "assistant", "content": "Grounded answer.", "tool_calls": None}}

    monkeypatch.setattr(ai_provider, "chat_completion", fake_completion)
    res = ai_agent.run_chat(db_session, _FakeSettings(), [{"role": "user", "content": "what sections?"}])
    assert res.answer == "Grounded answer."
    assert "list_sections" in res.tools_used


def test_agent_bounded_rounds_stops(monkeypatch, db_session):
    def always_tool(base_url, model, messages, tools):
        return {"message": {"role": "assistant", "content": None, "tool_calls": [
            {"id": "c", "type": "function", "function": {"name": "list_sections", "arguments": "{}"}}
        ]}}

    monkeypatch.setattr(ai_provider, "chat_completion", always_tool)
    res = ai_agent.run_chat(db_session, _FakeSettings(), [{"role": "user", "content": "loop"}])
    assert "stopped" in res.answer.lower()


def test_agent_handles_malformed_tool_arguments(monkeypatch, db_session):
    calls = {"n": 0}

    def fake_completion(base_url, model, messages, tools):
        calls["n"] += 1
        if calls["n"] == 1:
            return {"message": {"role": "assistant", "content": None, "tool_calls": [
                {"id": "c1", "type": "function",
                 "function": {"name": "get_section_records", "arguments": "NOT JSON"}}
            ]}}
        return {"message": {"role": "assistant", "content": "Recovered.", "tool_calls": None}}

    monkeypatch.setattr(ai_provider, "chat_completion", fake_completion)
    res = ai_agent.run_chat(db_session, _FakeSettings(), [{"role": "user", "content": "x"}])
    assert res.answer == "Recovered."
