import { afterEach, expect, test, vi } from "vitest";
import { apiFetch } from "./client";

afterEach(() => vi.restoreAllMocks());

test("retries once after a 401 when refresh succeeds", async () => {
  const calls: string[] = [];
  vi.spyOn(global, "fetch").mockImplementation((url) => {
    const u = String(url);
    calls.push(u);
    if (u.endsWith("/api/auth/refresh")) return Promise.resolve(new Response(null, { status: 200 }));
    const priorResourceCalls = calls.filter((c) => c.endsWith("/api/data")).length;
    if (priorResourceCalls === 1) return Promise.resolve(new Response(null, { status: 401 }));
    return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  });

  const res = await apiFetch("/api/data");
  expect(res.status).toBe(200);
  expect(calls.filter((c) => c.endsWith("/api/auth/refresh")).length).toBe(1);
});

test("does not retry when refresh fails", async () => {
  vi.spyOn(global, "fetch").mockImplementation((url) => {
    const u = String(url);
    if (u.endsWith("/api/auth/refresh")) return Promise.resolve(new Response(null, { status: 401 }));
    return Promise.resolve(new Response(null, { status: 401 }));
  });
  const res = await apiFetch("/api/data");
  expect(res.status).toBe(401);
});
