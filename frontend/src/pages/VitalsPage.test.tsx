import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));

const list = vi.fn();
const create = vi.fn();
const update = vi.fn();
const remove = vi.fn();
vi.mock("../api/vitals", () => ({
  vitalsApi: {
    list: () => list(),
    create: (d: unknown) => create(d),
    update: (id: string, d: unknown) => update(id, d),
    remove: (id: string) => remove(id),
  },
}));

import VitalsPage from "./VitalsPage";

const SAMPLE = {
  id: "v1", measured_at: "2026-06-10T14:30:00Z",
  bp_systolic: 120, bp_diastolic: 80, pulse_bpm: 72,
  height_in: 65, weight_lb: 150, temperature_f: null,
  respiratory_rate: null, spo2: null, blood_glucose: null,
  notes: null, visit_log_id: null, bmi: 25.0,
};

beforeEach(() => { list.mockReset(); create.mockReset(); update.mockReset(); remove.mockReset(); });

describe("VitalsPage", () => {
  it("admin opens an empty Add modal via the + Add button", async () => {
    list.mockResolvedValue([]);
    render(<VitalsPage />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    await userEvent.click(screen.getByText(/\+ add/i));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", "Add Vitals");
  });

  it("admin opens a pre-filled Edit modal from a row", async () => {
    list.mockResolvedValue([SAMPLE]);
    render(<VitalsPage />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    await userEvent.click(screen.getAllByLabelText(/^edit /i)[0]);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", "Edit Vitals");
    expect(within(dialog).getByLabelText(/systolic/i)).toHaveValue(120);
  });

  it("auto-calculates BMI in the modal as height and weight are entered", async () => {
    list.mockResolvedValue([]);
    render(<VitalsPage />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    await userEvent.click(screen.getByText(/\+ add/i));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/height/i), "65");
    await userEvent.type(within(dialog).getByLabelText(/weight/i), "150");
    expect(within(dialog).getByText(/25(\.0)?/)).toBeInTheDocument();
  });
});
