// frontend/src/pages/GuestSectionPage.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import GuestSectionPage from "./GuestSectionPage";
import { GuestProvider } from "../auth/GuestContext";
import * as guestApi from "../api/guest";

afterEach(() => vi.restoreAllMocks());

function renderSection(section = "vaccinations", token = "tok") {
  return render(
    <GuestProvider>
      <MemoryRouter initialEntries={[`/guest/sections/${section}?token=${token}`]}>
        <Routes>
          <Route path="/guest/sections/:section" element={<GuestSectionPage />} />
        </Routes>
      </MemoryRouter>
    </GuestProvider>
  );
}

describe("GuestSectionPage", () => {
  it("renders records list", async () => {
    vi.spyOn(guestApi, "listGuestRecords").mockResolvedValue([
      { id: "1", vaccine: "Flu Shot" },
    ]);
    renderSection();
    expect(await screen.findByText("View Record")).toBeInTheDocument();
  });

  it("shows an assertive empty state naming the section", async () => {
    // Reaching this page means the section WAS shared, so the message says
    // "none added" rather than the ambiguous "no records found" — which a
    // clinician could read as "this wasn't shared with me".
    vi.spyOn(guestApi, "listGuestRecords").mockResolvedValue([]);
    renderSection();
    expect(
      await screen.findByText(/no vaccinations records have been added/i),
    ).toBeInTheDocument();
  });

  it("shows no add or delete buttons", async () => {
    vi.spyOn(guestApi, "listGuestRecords").mockResolvedValue([{ id: "1", vaccine: "Flu" }]);
    renderSection();
    await screen.findByText("View Record");
    expect(screen.queryByRole("button", { name: /add/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });
});
