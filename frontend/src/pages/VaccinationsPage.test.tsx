// frontend/src/pages/VaccinationsPage.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import VaccinationsPage from "./VaccinationsPage";
import * as vacApi from "../api/vaccinations";
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

describe("VaccinationsPage", () => {
  it("lists vaccinations", async () => {
    mockAuth("viewer");
    vi.spyOn(vacApi.vaccinationsApi, "list").mockResolvedValue([
      { id: "1", vaccine: "Flu Shot", administered_date: null, lot_number: null,
        administrator: null, manufacturer: null, next_due_date: null, notes: null },
    ]);
    render(<MemoryRouter><VaccinationsPage /></MemoryRouter>);
    expect((await screen.findAllByText("Flu Shot")).length).toBeGreaterThan(0);
  });

  it("viewer sees no Add button", async () => {
    mockAuth("viewer");
    vi.spyOn(vacApi.vaccinationsApi, "list").mockResolvedValue([]);
    render(<MemoryRouter><VaccinationsPage /></MemoryRouter>);
    await screen.findByRole("heading", { name: "Vaccinations" });
    expect(screen.queryByRole("button", { name: /add/i })).not.toBeInTheDocument();
  });

  it("admin can add a vaccination", async () => {
    mockAuth("admin");
    const mockList = vi.spyOn(vacApi.vaccinationsApi, "list").mockResolvedValue([]);
    const mockCreate = vi.spyOn(vacApi.vaccinationsApi, "create").mockResolvedValue({
      id: "2", vaccine: "COVID-19", administered_date: null, lot_number: null,
      administrator: null, manufacturer: null, next_due_date: null, notes: null,
    });
    mockList.mockResolvedValueOnce([]).mockResolvedValue([
      { id: "2", vaccine: "COVID-19", administered_date: null, lot_number: null,
        administrator: null, manufacturer: null, next_due_date: null, notes: null },
    ]);
    render(<MemoryRouter><VaccinationsPage /></MemoryRouter>);
    await waitFor(() => expect(mockList).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /\+ add/i }));
    fireEvent.change(screen.getByLabelText("Vaccine"), { target: { value: "COVID-19" } });
    fireEvent.click(screen.getByRole("button", { name: /add vaccination/i }));
    expect((await screen.findAllByText("COVID-19")).length).toBeGreaterThan(0);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ vaccine: "COVID-19" }));
  });

  it("auto-opens edit modal when ?open=<id> is in the URL", async () => {
    mockAuth("admin");
    vi.spyOn(vacApi.vaccinationsApi, "list").mockResolvedValue([
      { id: "vac1", vaccine: "Flu Shot", administered_date: "2026-01-15",
        lot_number: null, administrator: null, manufacturer: null, next_due_date: null, notes: null },
    ]);
    render(
      <MemoryRouter initialEntries={["/vaccinations?open=vac1"]}>
        <VaccinationsPage />
      </MemoryRouter>
    );
    expect(await screen.findByRole("dialog", { name: /edit vaccination/i })).toBeInTheDocument();
  });
});
