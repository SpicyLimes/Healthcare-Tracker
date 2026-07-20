// frontend/src/pages/VisitLogsPage.test.tsx
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));

const list = vi.fn();
const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();
vi.mock("../api/visitLogs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/visitLogs")>()),
  visitLogsApi: {
    list: () => list(),
    create: (d: unknown) => create(d),
    update: (id: string, d: unknown) => update(id, d),
    remove: (id: string) => remove(id),
  },
}));
vi.mock("../api/doctors", () => ({
  doctorsApi: { list: vi.fn().mockResolvedValue([]) },
}));

import VisitLogsPage from "./VisitLogsPage";

const BASE = {
  visit_time: null, doctor_id: null, doctor_other: null, summary: null,
  follow_up: null, follow_up_date: null, notes: null,
  bp_systolic: null, bp_diastolic: null, pulse_bpm: null, height_in: null,
  weight_lb: null, temperature_f: null, respiratory_rate: null, spo2: null,
  blood_glucose: null, linked_vitals_id: null,
};

const ROWS = [
  { ...BASE, id: "vl1", visit_date: "2026-07-01", reason: "Annual", visit_type: "in_person" },
  { ...BASE, id: "vl2", visit_date: "2026-07-05", reason: "Med question", visit_type: "phone_call" },
];

function renderPage() {
  return render(<MemoryRouter><VisitLogsPage /></MemoryRouter>);
}

beforeEach(() => { list.mockReset(); create.mockReset(); update.mockReset(); remove.mockReset(); });

describe("VisitLogsPage — visit types", () => {
  it("shows the Visit Type dropdown defaulting to In-Person", async () => {
    list.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(list).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /\+ add/i }));
    const select = screen.getByLabelText("Visit Type") as HTMLSelectElement;
    expect(select.value).toBe("in_person");
    expect(within(select).getByRole("option", { name: "Phone Call" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Telehealth" })).toBeInTheDocument();
  });

  it("renders a type badge and filter pills that filter rows", async () => {
    list.mockResolvedValue(ROWS);
    renderPage();
    expect((await screen.findAllByText("Phone Call")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Phone Call" })[0]);
    expect(screen.queryAllByText("Med question").length).toBe(0);
    expect(screen.getAllByText("Annual").length).toBeGreaterThan(0);
  });

  it("page title reads Visit & Call Logs", async () => {
    list.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(screen.getAllByText("Visit & Call Logs").length).toBeGreaterThan(0);
  });
});
