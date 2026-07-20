// frontend/src/pages/SurgeriesPage.test.tsx
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));
vi.mock("../components/toast", () => ({ useToast: () => ({ showToast: vi.fn(), showAck: vi.fn() }) }));
vi.mock("../api/submissions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/submissions")>()),
  amendMySubmission: vi.fn(),
  getMySubmission: vi.fn(),
  myPendingCount: vi.fn().mockResolvedValue(0),
  pendingSubmissionCount: vi.fn().mockResolvedValue(0),
}));

const list = vi.fn();
const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();
vi.mock("../api/surgeries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/surgeries")>()),
  surgeriesApi: {
    list: () => list(),
    create: (d: unknown) => create(d),
    update: (id: string, d: unknown) => update(id, d),
    remove: (id: string) => remove(id),
  },
}));
vi.mock("../api/doctors", () => ({
  doctorsApi: { list: vi.fn().mockResolvedValue([]) },
}));

import SurgeriesPage from "./SurgeriesPage";

const BASE = {
  surgery_date: null, surgeon_id: null, surgeon_other: null,
  hospital: null, outcome: null, notes: null,
};

const ROWS = [
  { ...BASE, id: "s1", procedure: "Appendectomy", procedure_type: "surgery" },
  { ...BASE, id: "s2", procedure: "Mole removal", procedure_type: "outpatient" },
];

function renderPage() {
  return render(<MemoryRouter><SurgeriesPage /></MemoryRouter>);
}

beforeEach(() => { list.mockReset(); create.mockReset(); update.mockReset(); remove.mockReset(); });

describe("SurgeriesPage — Procedures", () => {
  it("renders Procedures title with Procedure Type dropdown (Surgery default)", async () => {
    list.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(screen.getAllByText("Procedures").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /\+ add/i }));
    const select = screen.getByLabelText("Procedure Type") as HTMLSelectElement;
    expect(select.value).toBe("surgery");
    expect(within(select).getByRole("option", { name: "Out-Patient" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Clinic" })).toBeInTheDocument();
  });

  it("type badge renders and pills filter rows", async () => {
    list.mockResolvedValue(ROWS);
    renderPage();
    expect((await screen.findAllByText("Appendectomy")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Out-Patient" })[0]);
    expect(screen.queryAllByText("Mole removal").length).toBe(0);
    expect(screen.getAllByText("Appendectomy").length).toBeGreaterThan(0);
  });
});
