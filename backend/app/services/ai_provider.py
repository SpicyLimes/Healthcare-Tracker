"""The ONLY module that makes outbound HTTP. Talks to a self-hosted,
OpenAI-compatible endpoint. Base URL comes from DB config — never hardcoded.
PHI trust boundary: record data only reaches this module via tool results that
the agent loop has already fetched from the local DB."""
import logging

import httpx

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(600.0, connect=5.0)


class ProviderUnavailable(Exception):
    """Raised when the configured LLM provider cannot be reached."""


def _client() -> httpx.Client:
    return httpx.Client(timeout=_TIMEOUT)


def chat_completion(base_url: str, model: str, messages: list[dict], tools: list[dict]) -> dict:
    """POST one OpenAI-compatible chat completion. Returns the first choice dict.
    Raises ProviderUnavailable on connect/timeout/HTTP errors or empty choices."""
    url = base_url.rstrip("/") + "/chat/completions"
    payload: dict = {"model": model, "messages": messages}
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"
    try:
        with _client() as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("AI provider call failed: %s", exc)
        raise ProviderUnavailable(str(exc)) from exc
    choices = data.get("choices") or []
    if not choices:
        raise ProviderUnavailable("Provider returned no choices.")
    return choices[0]


def ping(base_url: str, model: str) -> tuple[bool, str]:
    """Lightweight reachability check against the models endpoint."""
    url = base_url.rstrip("/") + "/models"
    try:
        with _client() as client:
            resp = client.get(url)
            resp.raise_for_status()
        return (True, "Reachable.")
    except httpx.HTTPError as exc:
        return (False, f"Unreachable: {exc}")
