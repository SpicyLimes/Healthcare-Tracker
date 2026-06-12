"""The bounded agent loop. Pure orchestration over ai_provider + ai_tools."""
import json
import uuid

from sqlalchemy.orm import Session

from app.schemas.ai import ChatResponse, Proposal
from app.services import ai_provider, ai_tools
from app.services.ai_write import TokenStore

MAX_ROUNDS = 5

_SYSTEM_PROMPT = (
    "You are a medical-records assistant for a single patient. Answer questions "
    "ONLY from the patient's records — call the read tools to look things up and "
    "never invent values, dates, dosages, or names.\n\n"
    "You can also help MANAGE records, always with the user's confirmation:\n"
    "- ADD: when the user describes an event, work out every section it implies "
    "(e.g. a visit may also imply a new medication and a follow-up appointment). "
    "Gather the fields from what they said; if a REQUIRED field is missing, ASK "
    "whether to provide it or leave it blank. Put doctor names in the *_other "
    "free-text field, never an id. Call propose_record for each section, then "
    "call commit_create for each only after the user agrees.\n"
    "- EDIT or DELETE: first use the read tools to find the exact record and its "
    "id. Call stage_edit or stage_delete, then READ THE RETURNED SUMMARY BACK to "
    "the user and ask them to confirm. Only after a clear yes, call commit_edit / "
    "commit_delete with the token from the stage step. Never edit or delete "
    "without explicit confirmation.\n\n"
    "Be concise and factual."
)


def run_chat(db: Session, settings, messages: list[dict], tz: str | None = None, actor_id=None) -> ChatResponse:
    token_store = TokenStore()
    convo: list[dict] = [{"role": "system", "content": _SYSTEM_PROMPT}]
    convo.extend({"role": m["role"], "content": m["content"]} for m in messages)
    tools_used: list[str] = []
    proposals: list[Proposal] = []

    for _ in range(MAX_ROUNDS):
        choice = ai_provider.chat_completion(settings.base_url, settings.model, convo, ai_tools.TOOL_DEFS)
        message = choice.get("message", {})
        tool_calls = message.get("tool_calls")
        if not tool_calls:
            return ChatResponse(answer=message.get("content") or "", tools_used=_unique(tools_used), proposals=proposals)

        # Self-hosted models (LM Studio, Ollama, llama.cpp) sometimes omit the
        # tool-call "id". A null id breaks the follow-up request on strict
        # OpenAI-compatible servers, so we synthesize one and keep the assistant
        # message and its tool replies referring to the SAME id.
        for call in tool_calls:
            if not call.get("id"):
                call["id"] = f"call_{uuid.uuid4().hex[:8]}"

        convo.append({"role": "assistant", "content": message.get("content"), "tool_calls": tool_calls})
        for call in tool_calls:
            fn = call.get("function", {})
            name = fn.get("name", "")
            try:
                args = json.loads(fn.get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            result = ai_tools.dispatch(db, name, args, tz=tz, actor_id=actor_id, token_store=token_store)
            tools_used.append(name)
            if isinstance(result, dict) and "error" not in result and result.get("action"):
                act = result["action"]
                if act == "create":
                    proposals.append(Proposal(action="create", section=result["section"],
                                              fields=result.get("fields"), warnings=result.get("warnings", [])))
                elif act == "edit":
                    proposals.append(Proposal(action="edit", section=result["section"],
                                              record_id=result.get("record_id"), fields=result.get("after"),
                                              before=result.get("before"), warnings=result.get("warnings", [])))
                elif act == "delete":
                    proposals.append(Proposal(action="delete", section=result["section"],
                                              record_id=result.get("record_id")))
            convo.append({
                "role": "tool",
                "tool_call_id": call["id"],
                "content": json.dumps(result, default=str),
            })

    return ChatResponse(answer="(Stopped: too many tool rounds.)", tools_used=_unique(tools_used), proposals=proposals)


def _unique(names: list[str]) -> list[str]:
    """De-duplicate tool names while preserving first-seen order (for clean audit labels)."""
    return list(dict.fromkeys(names))
