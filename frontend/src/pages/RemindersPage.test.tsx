// frontend/src/pages/RemindersPage.test.tsx
// Follows the NutritionPlanPage.test.tsx convention: vi.spyOn over module
// namespace imports (NOT vi.mock factories), and useAuth spied on so AppShell
// renders. Do not mock app-shell — no page test in this codebase does.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import RemindersPage from "./RemindersPage";
import * as remindersModule from "../api/reminders";
import * as summaryModule from "../api/summary";
import * as medicationsModule from "../api/medications";
import * as nutritionModule from "../api/nutritionPlan";
import * as useAuthModule from "../auth/useAuth";
import { defaultLayout } from "@/lib/reminder-layout";

afterEach(() => vi.restoreAllMocks());

const renderPage = () => render(<MemoryRouter><RemindersPage /></MemoryRouter>);

beforeEach(() => {
  // Mirror how NutritionPlanPage.test.tsx stubs useAuth — read that file and
  // copy the exact shape its `vi.spyOn(useAuthModule, "useAuth")` returns,
  // with role "admin".
  vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
    user: { id: "u1", email: "a@b.c", role: "admin" },
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
  } as unknown as ReturnType<typeof useAuthModule.useAuth>);
  vi.spyOn(remindersModule.remindersApi, "get").mockResolvedValue({ layout: defaultLayout(), updated_at: null });
  vi.spyOn(remindersModule.remindersApi, "save").mockResolvedValue({
    layout: defaultLayout(),
    updated_at: "2026-07-15T00:00:00Z",
  });
  vi.spyOn(summaryModule, "openSummaryInNewTab").mockImplementation(() => {});
  vi.spyOn(medicationsModule.medicationsApi, "list").mockResolvedValue([]);
  vi.spyOn(nutritionModule.unacceptableFoodsApi, "list").mockResolvedValue([]);
});

describe("RemindersPage", () => {
  it("loads and renders the saved layout", async () => {
    renderPage();
    expect(await screen.findByText("MY DAILY MEDICATIONS")).toBeInTheDocument();
    expect(screen.getByText("Multivitamin")).toBeInTheDocument();
  });

  it("falls back to a usable sheet when the API returns a malformed layout", async () => {
    vi.spyOn(remindersModule.remindersApi, "get").mockResolvedValue({ layout: "garbage" as never, updated_at: null });
    renderPage();
    expect(await screen.findByText("MY DAILY MEDICATIONS")).toBeInTheDocument();
  });

  it("shows an error when loading fails", async () => {
    vi.spyOn(remindersModule.remindersApi, "get").mockRejectedValue(new Error("boom"));
    renderPage();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("opens the print sheet in a new tab", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("MY DAILY MEDICATIONS");
    await user.click(screen.getByRole("button", { name: /print daily reminders/i }));
    expect(summaryModule.openSummaryInNewTab).toHaveBeenCalledOnce();
    expect(vi.mocked(summaryModule.openSummaryInNewTab).mock.calls[0][0]).toContain("size: 8.5in 11in");
  });

  it("saves the layout", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("MY DAILY MEDICATIONS");
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => expect(remindersModule.remindersApi.save).toHaveBeenCalledOnce());
  });

  it("shows a transient confirmation after a successful save", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("MY DAILY MEDICATIONS");
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(await screen.findByRole("button", { name: /^saved/i })).toBeInTheDocument();
  });

  it("keeps edits and shows an error when saving fails", async () => {
    vi.spyOn(remindersModule.remindersApi, "save").mockRejectedValue(new Error("nope"));
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("MY DAILY MEDICATIONS");
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("MY DAILY MEDICATIONS")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^saved/i })).not.toBeInTheDocument();
  });

  it("reports no active medications to import when all medications are inactive", async () => {
    vi.spyOn(medicationsModule.medicationsApi, "list").mockResolvedValue([
      {
        id: "m1",
        name: "Old Med",
        kind: "medication",
        dose: null,
        frequency: null,
        route: null,
        prescribing_doctor: null,
        prescribing_doctor_id: null,
        pharmacy_id: null,
        pharmacy_name: null,
        start_date: null,
        end_date: null,
        is_active: false,
        notes: null,
      },
    ]);
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("MY DAILY MEDICATIONS");
    await user.click(screen.getByRole("button", { name: /^edit this page$/i }));
    await user.click(screen.getByRole("button", { name: /import from medications/i }));
    expect(await screen.findByText("No active medications found to import.")).toBeInTheDocument();
    expect(screen.queryByText(/active medication\(s\) found/)).not.toBeInTheDocument();
  });
});
