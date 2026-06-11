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


def test_agent_handles_parallel_tool_calls_in_one_round(monkeypatch, db_session):
    calls = {"n": 0}

    def fake_completion(base_url, model, messages, tools):
        calls["n"] += 1
        if calls["n"] == 1:
            return {"message": {"role": "assistant", "content": None, "tool_calls": [
                {"id": "a", "type": "function", "function": {"name": "list_sections", "arguments": "{}"}},
                {"id": "b", "type": "function",
                 "function": {"name": "get_section_records", "arguments": "{\"section\": \"doctors\"}"}},
            ]}}
        # Second round: the convo must contain two tool replies with matching ids.
        tool_ids = {m.get("tool_call_id") for m in messages if m.get("role") == "tool"}
        assert tool_ids == {"a", "b"}
        return {"message": {"role": "assistant", "content": "Both done.", "tool_calls": None}}

    monkeypatch.setattr(ai_provider, "chat_completion", fake_completion)
    res = ai_agent.run_chat(db_session, _FakeSettings(), [{"role": "user", "content": "x"}])
    assert res.answer == "Both done."
    # both tools recorded, de-duplicated and order-preserved
    assert res.tools_used == ["list_sections", "get_section_records"]


def test_agent_synthesizes_missing_tool_call_id(monkeypatch, db_session):
    def fake_completion(base_url, model, messages, tools):
        # A round-2 call: every tool reply must carry a non-null tool_call_id even
        # though the provider omitted "id" in round 1.
        if any(m.get("role") == "tool" for m in messages):
            tool_ids = [m.get("tool_call_id") for m in messages if m.get("role") == "tool"]
            assert all(tid for tid in tool_ids)  # no None/empty ids
            return {"message": {"role": "assistant", "content": "ok", "tool_calls": None}}
        return {"message": {"role": "assistant", "content": None, "tool_calls": [
            {"type": "function", "function": {"name": "list_sections", "arguments": "{}"}},  # no "id"
        ]}}

    monkeypatch.setattr(ai_provider, "chat_completion", fake_completion)
    res = ai_agent.run_chat(db_session, _FakeSettings(), [{"role": "user", "content": "x"}])
    assert res.answer == "ok"


def test_agent_dedupes_repeated_tool_in_used_list(monkeypatch, db_session):
    calls = {"n": 0}

    def fake_completion(base_url, model, messages, tools):
        calls["n"] += 1
        if calls["n"] <= 2:
            return {"message": {"role": "assistant", "content": None, "tool_calls": [
                {"id": f"c{calls['n']}", "type": "function",
                 "function": {"name": "list_sections", "arguments": "{}"}}
            ]}}
        return {"message": {"role": "assistant", "content": "done", "tool_calls": None}}

    monkeypatch.setattr(ai_provider, "chat_completion", fake_completion)
    res = ai_agent.run_chat(db_session, _FakeSettings(), [{"role": "user", "content": "x"}])
    assert res.tools_used == ["list_sections"]
