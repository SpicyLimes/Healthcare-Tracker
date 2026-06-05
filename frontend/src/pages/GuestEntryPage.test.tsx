// frontend/src/pages/GuestEntryPage.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import GuestEntryPage from "./GuestEntryPage";
import { GuestProvider } from "../auth/GuestContext";
import * as guestApi from "../api/guest";

afterEach(() => vi.restoreAllMocks());

function renderEntry(token = "header.payload.sig") {
  return render(
    <GuestProvider>
      <MemoryRouter initialEntries={[`/guest?token=${token}`]}>
        <Routes>
          <Route path="/guest" element={<GuestEntryPage />} />
          <Route path="/guest/sections/:section" element={<p>Section page</p>} />
        </Routes>
      </MemoryRouter>
    </GuestProvider>
  );
}

describe("GuestEntryPage", () => {
  it("redirects to first section on valid token", async () => {
    vi.spyOn(guestApi, "getGuestSections").mockResolvedValue(["medications", "vaccinations"]);
    renderEntry();
    await waitFor(() => expect(screen.getByText("Section page")).toBeInTheDocument());
  });

  it("shows expired state on API error", async () => {
    vi.spyOn(guestApi, "getGuestSections").mockRejectedValue(new Error("401"));
    renderEntry();
    await waitFor(() => expect(screen.getByText(/link expired or revoked/i)).toBeInTheDocument());
  });

  it("shows expired state when no token provided", async () => {
    render(
      <GuestProvider>
        <MemoryRouter initialEntries={["/guest"]}>
          <Routes>
            <Route path="/guest" element={<GuestEntryPage />} />
          </Routes>
        </MemoryRouter>
      </GuestProvider>
    );
    await waitFor(() => expect(screen.getByText(/link expired or revoked/i)).toBeInTheDocument());
  });
});
