// frontend/src/pages/ShareLinksPage.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../auth/useAuth", () => ({
  useAuth: () => ({ user: { timezone: "America/Chicago" } }),
}));

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
    expect((await screen.findAllByText("Dr. Smith"))[0]).toBeInTheDocument();
    expect(screen.getAllByText("Active")[0]).toBeInTheDocument();
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
    await screen.findAllByText("Dr. Smith");
    fireEvent.click(screen.getByRole("button", { name: /revoke/i }));
    await waitFor(() => expect(revokeSpy).toHaveBeenCalledWith("abc-123"));
  });

  it("email action opens the form and sends to the recipient", async () => {
    vi.spyOn(api, "listShareLinks").mockResolvedValue([LINK]);
    const emailSpy = vi.spyOn(api, "emailShareLink").mockResolvedValue();
    render(<ShareLinksPage />);
    await screen.findAllByText("Dr. Smith");

    fireEvent.click(screen.getByRole("button", { name: /^email$/i }));
    fireEvent.change(screen.getByLabelText(/recipient/i), {
      target: { value: "dr@x.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));

    await waitFor(() =>
      expect(emailSpy).toHaveBeenCalledWith("abc-123", {
        recipient: "dr@x.com",
        message: "",
      }),
    );
  });

  it("email failure shows error and keeps copy link available", async () => {
    vi.spyOn(api, "listShareLinks").mockResolvedValue([LINK]);
    vi.spyOn(api, "emailShareLink").mockRejectedValue(
      new Error("Couldn't send the email. The link is still valid — you can copy it instead."),
    );
    render(<ShareLinksPage />);
    await screen.findAllByText("Dr. Smith");

    fireEvent.click(screen.getByRole("button", { name: /^email$/i }));
    fireEvent.change(screen.getByLabelText(/recipient/i), {
      target: { value: "dr@x.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText(/still valid/i)).toBeInTheDocument();
    // Copy link affordance remains in the table.
    expect(screen.getByRole("button", { name: /copy link/i })).toBeInTheDocument();
  });
});
