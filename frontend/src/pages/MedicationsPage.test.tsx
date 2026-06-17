import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import MedicationsPage from "./MedicationsPage";
import * as medsApi from "../api/medications";
import * as useAuthModule from "../auth/useAuth";

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

describe("MedicationsPage", () => {
  it("lists medications", async () => {
    mockAuth("viewer");
    vi.spyOn(medsApi.medicationsApi, "list").mockResolvedValue([
      { id: "1", name: "Aspirin", kind: "medication", dose: "81mg", frequency: null,
        prescribing_doctor: null, start_date: null, end_date: null, is_active: true, notes: null },
    ]);
    render(<MedicationsPage />);
    expect((await screen.findAllByText("Aspirin")).length).toBeGreaterThan(0);
  });

  it("viewer sees no Add button", async () => {
    mockAuth("viewer");
    vi.spyOn(medsApi.medicationsApi, "list").mockResolvedValue([]);
    render(<MedicationsPage />);
    // allow the effect to resolve
    await screen.findByText("Medications");
    expect(screen.queryByRole("button", { name: /add/i })).not.toBeInTheDocument();
  });

  it("admin opens an empty Add modal via the + Add button", async () => {
    mockAuth("admin");
    vi.spyOn(medsApi.medicationsApi, "list").mockResolvedValue([]);
    render(<MedicationsPage />);
    await screen.findByText("Medications");
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
      { id: "1", name: "Aspirin", kind: "medication", dose: "81mg", frequency: null,
        prescribing_doctor: null, start_date: null, end_date: null, is_active: true, notes: null },
    ]);
    render(<MedicationsPage />);
    await screen.findAllByText("Aspirin");
    // the desktop row renders an Edit button per row
    fireEvent.click(screen.getAllByRole("button", { name: /^edit /i })[0]);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", "Edit Medication");
    expect(within(dialog).getByLabelText(/medication name/i)).toHaveValue("Aspirin");
  });
});
