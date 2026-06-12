from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    # Assistant turns that only carried tool calls have null content.
    content: str | None = None


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)


class Proposal(BaseModel):
    action: Literal["create", "edit", "delete"]
    section: str
    fields: dict | None = None        # create/edit drafted fields
    record_id: str | None = None      # edit/delete target
    before: dict | None = None        # edit only: current values
    warnings: list[str] = Field(default_factory=list)


class ChatResponse(BaseModel):
    answer: str
    tools_used: list[str]
    proposals: list[Proposal] = Field(default_factory=list)
