import { describe, it, expect, vi, beforeEach } from "vitest";
import { emailShareLink } from "./shareLinks";

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
});
