import { csrfHeader } from "./csrf";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Proposal {
  action: "create" | "edit" | "delete";
  section: string;
  fields?: Record<string, unknown> | null;
  record_id?: string | null;
  before?: Record<string, unknown> | null;
  warnings?: string[];
}

export interface ChatResponse {
  answer: string;
  tools_used: string[];
  proposals?: Proposal[];
}

export class AiUnavailableError extends Error {}

export async function sendChat(messages: ChatMessage[]): Promise<ChatResponse> {
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...csrfHeader() },
    body: JSON.stringify({ messages }),
  });
  if (res.status === 503) throw new AiUnavailableError("AI assistant is unavailable.");
  if (!res.ok) throw new Error("Chat request failed");
  return res.json();
}
