// frontend/src/pages/ShareLinksPage.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ShareLinksPage from "./ShareLinksPage";
import * as api from "../api/shareLinks";

afterEach(() => vi.restoreAllMocks());

const LINK: api.ShareLink = {
  id: "abc-123",
  label: "Dr. Smith",
  allowed_sections: ["medications"],
  expires_at: new Date(Date.now() + 86400000 * 7).toISOString(),
  revoked: false,
  created_at: new Date().toISOString(),
  token_url: "/guest?token=existingtoken",
};

describe("ShareLinksPage", () => {
  it("renders link table", async () => {
    vi.spyOn(api, "listShareLinks").mockResolvedValue([LINK]);
    render(<ShareLinksPage />);
    expect(await screen.findByText("Dr. Smith")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows one-time token modal on create", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
    vi.spyOn(api, "listShareLinks").mockResolvedValue([]);
    vi.spyOn(api, "createShareLink").mockResolvedValue({
      ...LINK,
      token_url: "/guest?token=abc123",
    });
    render(<ShareLinksPage />);
    fireEvent.click(screen.getByRole("button", { name: /create link/i }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Test Link" } });
    fireEvent.click(screen.getByRole("button", { name: /^create$/i }));
    expect(await screen.findByText(/can also be copied from the table below/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy link/i })).toBeInTheDocument();
  });

  it("revoke button calls revokeShareLink", async () => {
    vi.spyOn(api, "listShareLinks").mockResolvedValue([LINK]);
    const revokeSpy = vi.spyOn(api, "revokeShareLink").mockResolvedValue();
    render(<ShareLinksPage />);
    await screen.findByText("Dr. Smith");
    fireEvent.click(screen.getByRole("button", { name: /revoke/i }));
    await waitFor(() => expect(revokeSpy).toHaveBeenCalledWith("abc-123"));
  });
});
