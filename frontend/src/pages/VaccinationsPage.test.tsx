// frontend/src/pages/VaccinationsPage.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import VaccinationsPage from "./VaccinationsPage";
import * as vacApi from "../api/vaccinations";
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

describe("VaccinationsPage", () => {
  it("lists vaccinations", async () => {
    mockAuth("viewer");
    vi.spyOn(vacApi.vaccinationsApi, "list").mockResolvedValue([
      { id: "1", vaccine: "Flu Shot", administered_date: null, lot_number: null,
        administrator: null, next_due_date: null, notes: null },
    ]);
    render(<VaccinationsPage />);
    expect(await screen.findByText("Flu Shot")).toBeInTheDocument();
  });

  it("viewer sees no Add button", async () => {
    mockAuth("viewer");
    vi.spyOn(vacApi.vaccinationsApi, "list").mockResolvedValue([]);
    render(<VaccinationsPage />);
    await screen.findByText("Vaccinations");
    expect(screen.queryByRole("button", { name: /add/i })).not.toBeInTheDocument();
  });

  it("admin can add a vaccination", async () => {
    mockAuth("admin");
    const mockList = vi.spyOn(vacApi.vaccinationsApi, "list").mockResolvedValue([]);
    const mockCreate = vi.spyOn(vacApi.vaccinationsApi, "create").mockResolvedValue({
      id: "2", vaccine: "COVID-19", administered_date: null, lot_number: null,
      administrator: null, next_due_date: null, notes: null,
    });
    mockList.mockResolvedValueOnce([]).mockResolvedValue([
      { id: "2", vaccine: "COVID-19", administered_date: null, lot_number: null,
        administrator: null, next_due_date: null, notes: null },
    ]);
    render(<VaccinationsPage />);
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Vaccine"), { target: { value: "COVID-19" } });
    fireEvent.click(screen.getByRole("button", { name: /add/i }));
    expect(await screen.findByText("COVID-19")).toBeInTheDocument();
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ vaccine: "COVID-19" }));
  });
});
