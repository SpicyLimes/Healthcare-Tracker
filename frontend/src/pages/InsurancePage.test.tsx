// frontend/src/pages/InsurancePage.test.tsx
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
vi.mock("../api/insurances", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/insurances")>()),
  insurancesApi: {
    list: () => list(),
    create: (d: unknown) => create(d),
    update: (id: string, d: unknown) => update(id, d),
    remove: (id: string) => remove(id),
  },
}));

import InsurancePage from "./InsurancePage";

const BASE = {
  policy_number: null, group_number: null, contact_phone: null,
  contact_address: null, notes: null,
};

const ROWS = [
  { ...BASE, id: "1", insurer_name: "ActiveIns", is_active: true },
  { ...BASE, id: "2", insurer_name: "InactiveIns", is_active: false },
];

function renderPage() {
  return render(<MemoryRouter><InsurancePage /></MemoryRouter>);
}

beforeEach(() => { list.mockReset(); create.mockReset(); update.mockReset(); remove.mockReset(); });

describe("InsurancePage — active/inactive", () => {
  it("shows a Status badge for each insurance row", async () => {
    list.mockResolvedValue(ROWS);
    renderPage();
    await waitFor(() => expect(list).toHaveBeenCalled());
    expect(await screen.findByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("defaults the Active checkbox to checked when adding", async () => {
    list.mockResolvedValue([]);
    renderPage();
    await waitFor(() => expect(list).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /\+ add/i }));
    const activeBox = await screen.findByLabelText(/active/i);
    expect(activeBox).toBeChecked();
  });
});
