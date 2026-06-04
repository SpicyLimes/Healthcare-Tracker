import { csrfHeader } from "./csrf";

/**
 * fetch wrapper that transparently retries once after a 401 by calling the
 * refresh endpoint. On refresh failure, returns the original 401 response.
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status !== 401 || input.endsWith("/api/auth/refresh") || input.endsWith("/api/auth/login")) {
    return res;
  }
  const refreshRes = await fetch("/api/auth/refresh", { method: "POST", headers: { ...csrfHeader() } });
  if (!refreshRes.ok) return res;
  return fetch(input, init);
}
