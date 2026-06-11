import { csrfHeader } from "./csrf";

export interface AiSettings {
  enabled: boolean;
  base_url: string | null;
  model: string | null;
}

export interface AiConnectionTest {
  reachable: boolean;
  detail: string;
}

export async function getAiSettings(): Promise<AiSettings> {
  const res = await fetch("/api/settings/ai");
  if (!res.ok) throw new Error("Failed to load AI settings");
  return res.json();
}

export async function updateAiSettings(patch: Partial<AiSettings>): Promise<AiSettings> {
  const res = await fetch("/api/settings/ai", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...csrfHeader() },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to save AI settings");
  return res.json();
}

export async function testAiConnection(): Promise<AiConnectionTest> {
  const res = await fetch("/api/settings/ai/test", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...csrfHeader() },
    body: "{}",
  });
  if (!res.ok) throw new Error("Failed to test connection");
  return res.json();
}
