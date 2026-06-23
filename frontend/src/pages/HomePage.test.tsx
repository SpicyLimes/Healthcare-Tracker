import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomePage from "./HomePage";
import * as profileApi from "../api/profile";
import * as useAuthModule from "../auth/useAuth";

// Mock all API modules that HomePage calls in useEffect
vi.mock("../api/calendar", () => ({ calendarApi: { list: vi.fn().mockResolvedValue([]) }, EVENT_TYPE_LABELS: {} }));
vi.mock("../api/vitals", () => ({ vitalsApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock("../api/medications", () => ({ medicationsApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock("../api/visitLogs", () => ({ visitLogsApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock("../api/surgeries", () => ({ surgeriesApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock("../api/hospitalizations", () => ({ hospitalizationsApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock("../api/vaccinations", () => ({ vaccinationsApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock("../api/insurances", () => ({ insurancesApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock("../api/pharmacies", () => ({ pharmaciesApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock("../api/doctors", () => ({ doctorsApi: { list: vi.fn().mockResolvedValue([]) } }));
vi.mock("../api/summary", () => ({ openSummaryInNewTab: vi.fn() }));

afterEach(() => vi.restoreAllMocks());

function mockAuth() {
  vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
    user: { id: "u1", email: "a@b.c", role: "admin" },
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
  } as unknown as ReturnType<typeof useAuthModule.useAuth>);
}

describe("HomePage Emergency Contacts POA dot", () => {
  it("shows POA dot next to POA contact name on dashboard", async () => {
    mockAuth();
    const contacts = JSON.stringify([
      { name: "Jane Smith", relationship: "Spouse/Partner", phone: "555-0001", email: "", is_poa: true, doc_ids: [] },
    ]);
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "p1",
      full_name: "Patient Name",
      date_of_birth: null,
      blood_type: null,
      allergies: null,
      emergency_contacts: contacts,
      primary_language: null,
      height: null,
      weight: null,
      phone: null,
      notes: null,
      main_doctor_id: null,
    });
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Jane Smith")).toBeInTheDocument());
    expect(screen.getByLabelText("Power of Attorney")).toBeInTheDocument();
  });

  it("does not show POA dot when contact is not POA", async () => {
    mockAuth();
    const contacts = JSON.stringify([
      { name: "Bob Jones", relationship: "Parent", phone: "", email: "", is_poa: false, doc_ids: [] },
    ]);
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "p1",
      full_name: "Patient Name",
      date_of_birth: null,
      blood_type: null,
      allergies: null,
      emergency_contacts: contacts,
      primary_language: null,
      height: null,
      weight: null,
      phone: null,
      notes: null,
      main_doctor_id: null,
    });
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Bob Jones")).toBeInTheDocument());
    expect(screen.queryByLabelText("Power of Attorney")).not.toBeInTheDocument();
  });
});
