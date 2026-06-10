import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
