"""ai_provider: OpenAI-compatible chat completion + reachability, fully mocked."""
import httpx
import pytest

from app.services import ai_provider


def _mock_client(handler):
    transport = httpx.MockTransport(handler)
    return httpx.Client(transport=transport)


def test_chat_completion_returns_choice(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/chat/completions")
        return httpx.Response(200, json={
            "choices": [{"message": {"role": "assistant", "content": "hello", "tool_calls": None}}]
        })

    monkeypatch.setattr(ai_provider, "_client", lambda: _mock_client(handler))
    choice = ai_provider.chat_completion("http://x/v1", "m", messages=[{"role": "user", "content": "hi"}], tools=[])
    assert choice["message"]["content"] == "hello"


def test_chat_completion_parses_tool_calls(monkeypatch):
    def handler(request):
        return httpx.Response(200, json={
            "choices": [{"message": {"role": "assistant", "content": None, "tool_calls": [
                {"id": "c1", "type": "function",
                 "function": {"name": "get_section_records", "arguments": "{\"section\": \"doctors\"}"}}
            ]}}]
        })

    monkeypatch.setattr(ai_provider, "_client", lambda: _mock_client(handler))
    choice = ai_provider.chat_completion("http://x/v1", "m", messages=[], tools=[])
    assert choice["message"]["tool_calls"][0]["function"]["name"] == "get_section_records"


def test_chat_completion_connect_error_raises_provider_unavailable(monkeypatch):
    def handler(request):
        raise httpx.ConnectError("refused")

    monkeypatch.setattr(ai_provider, "_client", lambda: _mock_client(handler))
    with pytest.raises(ai_provider.ProviderUnavailable):
        ai_provider.chat_completion("http://x/v1", "m", messages=[], tools=[])


def test_chat_completion_no_choices_raises(monkeypatch):
    def handler(request):
        return httpx.Response(200, json={"choices": []})

    monkeypatch.setattr(ai_provider, "_client", lambda: _mock_client(handler))
    with pytest.raises(ai_provider.ProviderUnavailable):
        ai_provider.chat_completion("http://x/v1", "m", messages=[], tools=[])


def test_chat_completion_sends_tools_when_provided(monkeypatch):
    captured = {}

    def handler(request):
        import json as _json
        captured["body"] = _json.loads(request.content)
        return httpx.Response(200, json={"choices": [{"message": {"content": "ok"}}]})

    monkeypatch.setattr(ai_provider, "_client", lambda: _mock_client(handler))
    tools = [{"type": "function", "function": {"name": "t", "parameters": {}}}]
    ai_provider.chat_completion("http://x/v1", "m", messages=[], tools=tools)
    assert captured["body"]["tools"] == tools
    assert captured["body"]["tool_choice"] == "auto"
    assert captured["body"]["model"] == "m"


def test_ping_reachable(monkeypatch):
    def handler(request):
        assert request.url.path.endswith("/models")
        return httpx.Response(200, json={"data": [{"id": "m"}]})

    monkeypatch.setattr(ai_provider, "_client", lambda: _mock_client(handler))
    ok, _ = ai_provider.ping("http://x/v1", "m")
    assert ok is True


def test_ping_unreachable(monkeypatch):
    def handler(request):
        raise httpx.ConnectError("refused")

    monkeypatch.setattr(ai_provider, "_client", lambda: _mock_client(handler))
    ok, detail = ai_provider.ping("http://x/v1", "m")
    assert ok is False
    assert detail
