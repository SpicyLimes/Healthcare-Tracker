import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ user: { role: "admin" } }) }));
vi.mock("../components/toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));

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
    // Enter 5 ft + 5 in = 65 total inches; weight 150 lb → BMI 25.0
    await userEvent.type(within(dialog).getByPlaceholderText(/^ft$/i), "5");
    await userEvent.type(within(dialog).getByPlaceholderText(/^in$/i), "5");
    await userEvent.type(within(dialog).getByLabelText(/weight/i), "150");
    expect(within(dialog).getByText(/25(\.0)?/)).toBeInTheDocument();
  });

  it("height fields combine to total inches on submit", async () => {
    list.mockResolvedValue([]);
    create.mockResolvedValue({ id: "v2" });
    render(<VitalsPage />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    await userEvent.click(screen.getByText(/\+ add/i));
    const dialog = await screen.findByRole("dialog");
    // Fill required datetime field (fireEvent.change works reliably with datetime-local in jsdom)
    const dtInput = within(dialog).getByLabelText(/date.*time/i);
    fireEvent.change(dtInput, { target: { value: "2026-06-22T10:00" } });
    // Enter 5 ft 4 in = 64 total inches
    await userEvent.type(within(dialog).getByPlaceholderText(/^ft$/i), "5");
    await userEvent.type(within(dialog).getByPlaceholderText(/^in$/i), "4");
    await userEvent.click(within(dialog).getByRole("button", { name: /add vitals/i }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    const payload = create.mock.calls[0][0];
    expect(payload.height_in).toBe(64);
  });

  it("displays height as feet and inches in detail view", async () => {
    list.mockResolvedValue([SAMPLE]); // SAMPLE has height_in: 65
    render(<VitalsPage />);
    await waitFor(() => expect(list).toHaveBeenCalled());
    // SAMPLE height_in is 65 → 5'5"
    // RecordTable More button has aria-label "More details for <detailTitle>"
    await userEvent.click(screen.getAllByRole("button", { name: /more details for/i })[0]);
    expect(await screen.findByText(/5'5"/)).toBeInTheDocument();
  });
});
