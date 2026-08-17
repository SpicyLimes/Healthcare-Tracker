import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MedicationsPage from "./MedicationsPage";
import * as medsApi from "../api/medications";
import * as pharmaciesApiModule from "../api/pharmacies";
import * as useAuthModule from "../auth/useAuth";

vi.mock("../components/toast", () => ({ useToast: () => ({ showToast: vi.fn(), showAck: vi.fn() }) }));

vi.mock("../api/documents", () => ({
  listDocumentsForRecord: vi.fn().mockResolvedValue([]),
  uploadDocument: vi.fn(),
  deleteDocument: vi.fn(),
  getDownloadUrl: vi.fn().mockReturnValue("#"),
}));

afterEach(() => vi.restoreAllMocks());

function mockAuth(role: "admin" | "viewer") {
  vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
    user: { id: "u1", email: "a@b.c", role },
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
  } as unknown as ReturnType<typeof useAuthModule.useAuth>);
}

function mockPharmaciesList() {
  vi.spyOn(pharmaciesApiModule.pharmaciesApi, "list").mockResolvedValue([
    { id: "p1", name: "CVS Main St", address: null, phone: null, fax: null, notes: null },
  ] as never);
}

describe("MedicationsPage", () => {
  it("lists medications", async () => {
    mockAuth("viewer");
    vi.spyOn(medsApi.medicationsApi, "list").mockResolvedValue([
      { id: "1", name: "Aspirin", kind: "medication", used_for: null, dose: "81mg", frequency: null,
        prescribing_doctor: null, start_date: null, end_date: null, is_active: true, notes: null },
    ]);
    render(<MemoryRouter><MedicationsPage /></MemoryRouter>);
    expect((await screen.findAllByText("Aspirin")).length).toBeGreaterThan(0);
  });

  it("viewer sees no Add button", async () => {
    mockAuth("viewer");
    vi.spyOn(medsApi.medicationsApi, "list").mockResolvedValue([]);
    render(<MemoryRouter><MedicationsPage /></MemoryRouter>);
    // allow the effect to resolve
    await screen.findByRole("heading", { name: "Medications" });
    expect(screen.queryByRole("button", { name: /add/i })).not.toBeInTheDocument();
  });

  it("admin opens an empty Add modal via the + Add button", async () => {
    mockAuth("admin");
    vi.spyOn(medsApi.medicationsApi, "list").mockResolvedValue([]);
    render(<MemoryRouter><MedicationsPage /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Medications" });
    // no dialog until the button is clicked
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /\+ add/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", "Add Medication");
    // the Name field is empty in add mode
    expect(within(dialog).getByLabelText(/medication name/i)).toHaveValue("");
  });

  it("admin opens a pre-filled Edit modal from a row", async () => {
    mockAuth("admin");
    vi.spyOn(medsApi.medicationsApi, "list").mockResolvedValue([
      { id: "1", name: "Aspirin", kind: "medication", used_for: null, dose: "81mg", frequency: null,
        prescribing_doctor: null, start_date: null, end_date: null, is_active: true, notes: null },
    ]);
    render(<MemoryRouter><MedicationsPage /></MemoryRouter>);
    await screen.findAllByText("Aspirin");
    // the desktop row renders an Edit button per row
    fireEvent.click(screen.getAllByRole("button", { name: /^edit /i })[0]);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", "Edit Medication");
    expect(within(dialog).getByLabelText(/medication name/i)).toHaveValue("Aspirin");
  });

  it("auto-opens edit modal when ?open=<id> is in the URL", async () => {
    mockAuth("admin");
    vi.spyOn(medsApi.medicationsApi, "list").mockResolvedValue([
      { id: "med1", name: "Aspirin", kind: "medication", used_for: null, dose: "81mg", frequency: null,
        prescribing_doctor: null, start_date: null, end_date: null, is_active: true, notes: null },
    ]);
    render(
      <MemoryRouter initialEntries={["/medications?open=med1"]}>
        <MedicationsPage />
      </MemoryRouter>
    );
    expect(await screen.findByRole("dialog", { name: /edit medication/i })).toBeInTheDocument();
  });

  it("Add modal contains a pharmacy picker and create sends pharmacy_id", async () => {
    mockAuth("admin");
    mockPharmaciesList();
    vi.spyOn(medsApi.medicationsApi, "list").mockResolvedValue([]);
    const create = vi.spyOn(medsApi.medicationsApi, "create").mockResolvedValue({} as never);
    render(<MemoryRouter><MedicationsPage /></MemoryRouter>);

    await screen.findByRole("heading", { name: "Medications" });
    fireEvent.click(screen.getByRole("button", { name: /\+ add/i }));
    fireEvent.change(screen.getByLabelText(/medication name/i), { target: { value: "NewMed" } });
    fireEvent.change(await screen.findByLabelText("Select pharmacy"), { target: { value: "p1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({ name: "NewMed", pharmacy_id: "p1" });
  });

  it("editing a doctor-linked med does not clobber the free-text prescriber", async () => {
    mockAuth("admin");
    mockPharmaciesList();
    vi.spyOn(medsApi.medicationsApi, "list").mockResolvedValue([
      { id: "m1", name: "Lisinopril", kind: "medication", used_for: null, dose: null, frequency: null,
        route: null, prescribing_doctor: "Dr. Resolved Name", prescribing_doctor_id: "d1",
        pharmacy_id: null, pharmacy_name: null,
        start_date: null, end_date: null, is_active: true, notes: null },
    ]);
    const update = vi.spyOn(medsApi.medicationsApi, "update").mockResolvedValue({} as never);
    render(<MemoryRouter><MedicationsPage /></MemoryRouter>);

    await screen.findAllByText("Lisinopril");
    fireEvent.click(screen.getAllByRole("button", { name: /^edit /i })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(update).toHaveBeenCalled());
    // The resolved display name must NOT be written into the free-text column.
    expect(update.mock.calls[0][1]).toMatchObject({ prescribing_doctor: null, prescribing_doctor_id: "d1" });
  });

  it("shows Used For in the table and preserves it through an edit", async () => {
    mockAuth("admin");
    mockPharmaciesList();
    vi.spyOn(medsApi.medicationsApi, "list").mockResolvedValue([
      { id: "m1", name: "Ritalin", kind: "medication", used_for: "ADD/ADHD", dose: "10 mg",
        frequency: null, route: null, prescribing_doctor: null, prescribing_doctor_id: null,
        pharmacy_id: null, pharmacy_name: null,
        start_date: null, end_date: null, is_active: true, notes: null },
    ]);
    const update = vi.spyOn(medsApi.medicationsApi, "update").mockResolvedValue({} as never);
    render(<MemoryRouter><MedicationsPage /></MemoryRouter>);

    // Visible at a glance, without opening the record.
    expect(await screen.findAllByText("ADD/ADHD")).not.toHaveLength(0);

    // Saving an untouched edit form must not blank it — the field has to be
    // seeded in openEdit, not just rendered.
    fireEvent.click(screen.getAllByRole("button", { name: /^edit /i })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0][1]).toMatchObject({ used_for: "ADD/ADHD" });
  });

  it("detail modal shows the pharmacy name", async () => {
    mockAuth("viewer");
    mockPharmaciesList();
    vi.spyOn(medsApi.medicationsApi, "list").mockResolvedValue([
      { id: "m1", name: "Lisinopril", kind: "medication", used_for: null, dose: null, frequency: null,
        route: null, prescribing_doctor: null, prescribing_doctor_id: null,
        pharmacy_id: "p1", pharmacy_name: "CVS Main St",
        start_date: null, end_date: null, is_active: true, notes: null },
    ]);
    render(<MemoryRouter><MedicationsPage /></MemoryRouter>);

    await screen.findAllByText("Lisinopril");
    fireEvent.click(screen.getAllByRole("button", { name: /more details for/i })[0]);
    expect(await screen.findByText("Pharmacy")).toBeInTheDocument();
    expect(screen.getByText("CVS Main St")).toBeInTheDocument();
  });
});
