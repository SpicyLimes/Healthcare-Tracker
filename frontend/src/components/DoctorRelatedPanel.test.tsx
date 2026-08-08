import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DoctorRelatedPanel from "./DoctorRelatedPanel";
import * as doctorsModule from "../api/doctors";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPanel() {
  render(
    <MemoryRouter>
      <DoctorRelatedPanel doctorId="doc-1" />
    </MemoryRouter>
  );
}

describe("DoctorRelatedPanel", () => {
  it("groups records by the clinical role, which is the whole point", async () => {
    // A merged list of 5 records would lose that 4 were prescribed and 1 operated.
    vi.spyOn(doctorsModule, "getRelatedRecords").mockResolvedValue([
      {
        role: "Prescriber", section: "medications", count: 2,
        items: [
          { id: "m1", title: "Metformin — 500mg", date: "2025-01-01" },
          { id: "m2", title: "Lisinopril", date: null },
        ],
      },
      {
        role: "Surgeon", section: "surgeries", count: 1,
        items: [{ id: "s1", title: "Knee replacement", date: "2024-06-01" }],
      },
    ]);
    renderPanel();

    expect(await screen.findByText(/Prescriber/)).toBeInTheDocument();
    expect(screen.getByText(/Surgeon/)).toBeInTheDocument();
    expect(screen.getByText("Metformin — 500mg")).toBeInTheDocument();
    expect(screen.getByText("Knee replacement")).toBeInTheDocument();
    expect(screen.getByText(/3 linked records/)).toBeInTheDocument();
  });

  it("links each group to the section's real route, not its key", async () => {
    // surgeries lives at /procedures — the key and the URL differ.
    vi.spyOn(doctorsModule, "getRelatedRecords").mockResolvedValue([
      { role: "Surgeon", section: "surgeries", count: 1,
        items: [{ id: "s1", title: "Knee replacement", date: null }] },
    ]);
    renderPanel();

    const link = await screen.findByRole("link", { name: /open procedures/i });
    expect(link).toHaveAttribute("href", "/procedures");
  });

  it("does not pair a count of 1 with a plural section label", async () => {
    // "Surgeon (1 procedures)" — section labels are plural, so the count read
    // as broken grammar on every single-record group.
    vi.spyOn(doctorsModule, "getRelatedRecords").mockResolvedValue([
      { role: "Surgeon", section: "surgeries", count: 1,
        items: [{ id: "s1", title: "Knee replacement", date: null }] },
    ]);
    renderPanel();
    await screen.findByText(/Surgeon/);
    expect(screen.queryByText(/1 procedures/)).toBeNull();
    expect(screen.getByText("(1)")).toBeInTheDocument();
  });

  it("says so plainly when nothing is linked", async () => {
    vi.spyOn(doctorsModule, "getRelatedRecords").mockResolvedValue([]);
    renderPanel();
    expect(await screen.findByText(/nothing is linked/i)).toBeInTheDocument();
  });

  it("renders the singleton Primary Care group even with no items", async () => {
    vi.spyOn(doctorsModule, "getRelatedRecords").mockResolvedValue([
      { role: "Primary Care", section: "profile", count: 1, items: [] },
    ]);
    renderPanel();
    expect(await screen.findByText(/Primary Care/)).toBeInTheDocument();
  });

  it("surfaces a failure instead of rendering an empty state", async () => {
    // "Nothing is linked" on a network error would be a lie about the chart.
    vi.spyOn(doctorsModule, "getRelatedRecords").mockRejectedValue(new Error("boom"));
    renderPanel();
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
    expect(screen.queryByText(/nothing is linked/i)).toBeNull();
  });

  it("uses the singular for one record", async () => {
    vi.spyOn(doctorsModule, "getRelatedRecords").mockResolvedValue([
      { role: "Surgeon", section: "surgeries", count: 1,
        items: [{ id: "s1", title: "Knee replacement", date: null }] },
    ]);
    renderPanel();
    expect(await screen.findByText(/1 linked record,/)).toBeInTheDocument();
  });

  it("refetches when a different doctor is opened", async () => {
    const spy = vi.spyOn(doctorsModule, "getRelatedRecords").mockResolvedValue([]);
    const { rerender } = render(
      <MemoryRouter><DoctorRelatedPanel doctorId="doc-1" /></MemoryRouter>
    );
    await waitFor(() => expect(spy).toHaveBeenCalledWith("doc-1"));
    rerender(<MemoryRouter><DoctorRelatedPanel doctorId="doc-2" /></MemoryRouter>);
    await waitFor(() => expect(spy).toHaveBeenCalledWith("doc-2"));
  });
});
