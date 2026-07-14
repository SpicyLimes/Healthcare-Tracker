import { describe, it, expect, vi, beforeEach } from "vitest";
import { emailShareLink, getEmailStatus } from "./shareLinks";

vi.mock("./client", () => ({
  apiFetch: vi.fn(),
}));
vi.mock("./csrf", () => ({ csrfHeader: () => ({ "X-CSRF-Token": "t" }) }));

import { apiFetch } from "./client";

describe("emailShareLink", () => {
  beforeEach(() => vi.clearAllMocks());

  it("POSTs recipient + message and resolves on ok", async () => {
    (apiFetch as any).mockResolvedValue({ ok: true });
    await emailShareLink("id-1", { recipient: "d@x.com", message: "hi" });
    expect(apiFetch).toHaveBeenCalledWith(
      "/api/share-links/id-1/email",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws the backend detail on failure", async () => {
    (apiFetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "Couldn't send the email. The link is still valid — you can copy it instead." }),
    });
    await expect(emailShareLink("id-1", { recipient: "d@x.com" })).rejects.toThrow(/still valid/);
  });

  it("keeps the friendly fallback when detail is not a string (422 arrays)", async () => {
    (apiFetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({ detail: [{ loc: ["body", "message"], msg: "too long" }] }),
    });
    await expect(emailShareLink("id-1", { recipient: "d@x.com" })).rejects.toThrow(
      /still valid — you can copy it instead/,
    );
  });
});

describe("getEmailStatus", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns true only when the backend reports configured", async () => {
    (apiFetch as any).mockResolvedValue({ ok: true, json: async () => ({ configured: true }) });
    await expect(getEmailStatus()).resolves.toBe(true);
  });

  it("returns false on a non-ok response", async () => {
    (apiFetch as any).mockResolvedValue({ ok: false, json: async () => ({}) });
    await expect(getEmailStatus()).resolves.toBe(false);
  });
});
