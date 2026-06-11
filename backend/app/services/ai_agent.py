"""The bounded agent loop. Pure orchestration over ai_provider + ai_tools."""
import json

from sqlalchemy.orm import Session

from app.schemas.ai import ChatResponse
from app.services import ai_provider, ai_tools

MAX_ROUNDS = 5

_SYSTEM_PROMPT = (
    "You are a medical-records assistant for a single patient. You answer ONLY "
    "from the patient's records. You MUST call the provided tools to read data; "
    "never invent values, dates, dosages, or names. If the records do not contain "
    "the answer, say so. Be concise and factual."
)


def run_chat(db: Session, settings, messages: list[dict]) -> ChatResponse:
    convo: list[dict] = [{"role": "system", "content": _SYSTEM_PROMPT}]
    convo.extend({"role": m["role"], "content": m["content"]} for m in messages)
    tools_used: list[str] = []

    for _ in range(MAX_ROUNDS):
        choice = ai_provider.chat_completion(settings.base_url, settings.model, convo, ai_tools.TOOL_DEFS)
        message = choice.get("message", {})
        tool_calls = message.get("tool_calls")
        if not tool_calls:
            return ChatResponse(answer=message.get("content") or "", tools_used=tools_used)

        convo.append({"role": "assistant", "content": message.get("content"), "tool_calls": tool_calls})
        for call in tool_calls:
            fn = call.get("function", {})
            name = fn.get("name", "")
            try:
                args = json.loads(fn.get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            result = ai_tools.dispatch(db, name, args)
            tools_used.append(name)
            convo.append({
                "role": "tool",
                "tool_call_id": call.get("id"),
                "content": json.dumps(result, default=str),
            })

    return ChatResponse(answer="(Stopped: too many tool rounds.)", tools_used=tools_used)
