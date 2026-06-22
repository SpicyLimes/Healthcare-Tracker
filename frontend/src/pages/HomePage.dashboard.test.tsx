import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomePage from "./HomePage";
import * as useAuthModule from "../auth/useAuth";
import * as profileApi from "../api/profile";
import * as vitalsApiModule from "../api/vitals";
import * as medicationsApiModule from "../api/medications";
import * as visitLogsApiModule from "../api/visitLogs";
import * as surgeriesApiModule from "../api/surgeries";
import * as hospitalizationsApiModule from "../api/hospitalizations";
import * as vaccinationsApiModule from "../api/vaccinations";
import * as insurancesApiModule from "../api/insurances";
import * as pharmaciesApiModule from "../api/pharmacies";
import * as doctorsApiModule from "../api/doctors";
import * as calendarApiModule from "../api/calendar";

afterEach(() => vi.restoreAllMocks());

function mockAuth(role: "admin" | "viewer" = "admin") {
  vi.spyOn(useAuthModule, "useAuth").mockReturnValue({
    user: { id: "u1", email: "a@b.c", role, full_name: "Jane Doe", timezone: "America/Chicago" },
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
  } as unknown as ReturnType<typeof useAuthModule.useAuth>);
}

function mockAllApis(overrides: Record<string, unknown> = {}) {
  vi.spyOn(calendarApiModule.calendarApi, "list").mockResolvedValue([]);
  vi.spyOn(profileApi, "getProfile").mockResolvedValue({
    id: "p1", full_name: "Jane Doe", date_of_birth: "1990-05-15", blood_type: "O+",
    allergies: null, emergency_contacts: null, primary_language: null,
    height: null, weight: null, phone: null, notes: null, main_doctor_id: null,
    ...overrides,
  });
  vi.spyOn(vitalsApiModule.vitalsApi, "list").mockResolvedValue([]);
  vi.spyOn(medicationsApiModule.medicationsApi, "list").mockResolvedValue([]);
  vi.spyOn(visitLogsApiModule.visitLogsApi, "list").mockResolvedValue([]);
  vi.spyOn(surgeriesApiModule.surgeriesApi, "list").mockResolvedValue([]);
  vi.spyOn(hospitalizationsApiModule.hospitalizationsApi, "list").mockResolvedValue([]);
  vi.spyOn(vaccinationsApiModule.vaccinationsApi, "list").mockResolvedValue([]);
  vi.spyOn(insurancesApiModule.insurancesApi, "list").mockResolvedValue([]);
  vi.spyOn(pharmaciesApiModule.pharmaciesApi, "list").mockResolvedValue([]);
  vi.spyOn(doctorsApiModule.doctorsApi, "list").mockResolvedValue([]);
}

describe("Dashboard sections", () => {
  it("renders Patient Info card with name, DOB, blood type", async () => {
    mockAuth();
    mockAllApis();
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());
    expect(screen.getByText(/May 15, 1990/i)).toBeInTheDocument();
    expect(screen.getByText("O+")).toBeInTheDocument();
  });

  it("shows Main Doctor name when main_doctor_id is set", async () => {
    mockAuth();
    mockAllApis({ main_doctor_id: "d1" });
    vi.spyOn(doctorsApiModule.doctorsApi, "list").mockResolvedValue([
      { id: "d1", name: "Dr. Smith", specialty: "Cardiology", practice: null,
        phone: null, fax: null, address: null, patient_portal_url: null, notes: null },
    ]);
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/Dr\. Smith/)).toBeInTheDocument());
  });

  it("shows most recent vitals (BP, pulse, weight)", async () => {
    mockAuth();
    mockAllApis();
    vi.spyOn(vitalsApiModule.vitalsApi, "list").mockResolvedValue([
      { id: "v1", measured_at: "2026-06-10T10:00:00Z", bp_systolic: 120, bp_diastolic: 80,
        pulse_bpm: 72, height_in: null, weight_lb: 155, temperature_f: null,
        respiratory_rate: null, spo2: null, blood_glucose: null, notes: null,
        visit_log_id: null, bmi: null },
    ]);
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/120\/80/)).toBeInTheDocument());
    expect(screen.getByText(/72/)).toBeInTheDocument();
    expect(screen.getByText(/155/)).toBeInTheDocument();
  });

  it("lists only active medications", async () => {
    mockAuth();
    mockAllApis();
    vi.spyOn(medicationsApiModule.medicationsApi, "list").mockResolvedValue([
      { id: "m1", name: "Lisinopril", kind: "medication", dose: null, frequency: null,
        route: null, prescribing_doctor: null, prescribing_doctor_id: null,
        start_date: null, end_date: null, is_active: true, notes: null },
      { id: "m2", name: "OldMed", kind: "medication", dose: null, frequency: null,
        route: null, prescribing_doctor: null, prescribing_doctor_id: null,
        start_date: null, end_date: null, is_active: false, notes: null },
    ]);
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Lisinopril")).toBeInTheDocument());
    expect(screen.queryByText("OldMed")).not.toBeInTheDocument();
  });

  it("shows most recent visit log date and reason", async () => {
    mockAuth();
    mockAllApis();
    vi.spyOn(visitLogsApiModule.visitLogsApi, "list").mockResolvedValue([
      { id: "vl1", visit_date: "2026-06-01", visit_time: null, doctor_id: null,
        doctor_other: null, reason: "Annual checkup", summary: null, follow_up: null,
        follow_up_date: null, notes: null, bp_systolic: null, bp_diastolic: null,
        pulse_bpm: null, linked_vitals_id: null },
    ]);
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/Annual checkup/)).toBeInTheDocument());
  });

  it("shows most recent surgery and hospitalization and vaccination", async () => {
    mockAuth();
    mockAllApis();
    vi.spyOn(surgeriesApiModule.surgeriesApi, "list").mockResolvedValue([
      { id: "s1", procedure: "Appendectomy", surgery_date: "2025-03-15",
        surgeon_id: null, surgeon_other: null, hospital: null, outcome: null, notes: null },
    ]);
    vi.spyOn(hospitalizationsApiModule.hospitalizationsApi, "list").mockResolvedValue([
      { id: "h1", facility: "City Hospital", admission_date: "2024-01-10",
        discharge_date: null, reason: null, attending_physician_id: null,
        attending_physician_other: null, outcome: null, notes: null },
    ]);
    vi.spyOn(vaccinationsApiModule.vaccinationsApi, "list").mockResolvedValue([
      { id: "vc1", vaccine: "Influenza", administered_date: "2026-01-05",
        lot_number: null, administrator: null, manufacturer: null,
        next_due_date: null, notes: null },
    ]);
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/Appendectomy/)).toBeInTheDocument());
    expect(screen.getByText(/City Hospital/)).toBeInTheDocument();
    expect(screen.getByText(/Influenza/)).toBeInTheDocument();
  });

  it("renders allergies card from profile JSON", async () => {
    mockAuth();
    const stored = JSON.stringify([
      { medication: "Penicillin", reaction: "Hives", age_of_onset: "12" }
    ]);
    mockAllApis({ allergies: stored });
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/Penicillin/)).toBeInTheDocument());
    expect(screen.getByText(/Hives/)).toBeInTheDocument();
  });

  it("renders emergency contacts from profile JSON", async () => {
    mockAuth();
    const stored = JSON.stringify([
      { name: "Bob Smith", relationship: "Spouse/Partner", phone: "555-1234", email: "bob@example.com" }
    ]);
    mockAllApis({ emergency_contacts: stored });
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/Bob Smith/)).toBeInTheDocument());
    expect(screen.getByText(/555-1234/)).toBeInTheDocument();
  });

  it("lists all insurance records", async () => {
    mockAuth();
    mockAllApis();
    vi.spyOn(insurancesApiModule.insurancesApi, "list").mockResolvedValue([
      { id: "i1", insurer_name: "BlueCross", policy_number: "POL123",
        group_number: null, contact_phone: null, contact_address: null, notes: null },
    ]);
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/BlueCross/)).toBeInTheDocument());
    expect(screen.getByText(/POL123/)).toBeInTheDocument();
  });

  it("shows empty states when no data", async () => {
    mockAuth();
    mockAllApis();
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("No allergies on file.")).toBeInTheDocument());
    expect(screen.getByText("No emergency contacts on file.")).toBeInTheDocument();
    expect(screen.getByText(/No insurance on file\./)).toBeInTheDocument();
    expect(screen.getByText(/No pharmacies on file\./)).toBeInTheDocument();
  });

  it("renders Print Summary button", async () => {
    mockAuth();
    mockAllApis();
    render(<MemoryRouter><HomePage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("Jane Doe")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /print summary/i })).toBeInTheDocument();
  });
});
