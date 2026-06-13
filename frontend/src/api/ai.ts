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

// 10-minute timeout matches the backend's httpx timeout — needed for CPU-only
// Ollama cold starts which can take several minutes to load the model.
const CHAT_TIMEOUT_MS = 600_000;

export async function sendChat(messages: ChatMessage[]): Promise<ChatResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...csrfHeader() },
      body: JSON.stringify({ messages }),
      signal: controller.signal,
    });
    if (res.status === 503) throw new AiUnavailableError("AI assistant is unavailable.");
    if (!res.ok) throw new Error("Chat request failed");
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}
