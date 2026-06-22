import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ProfilePage from "./ProfilePage";
import * as profileApi from "../api/profile";
import * as useAuthModule from "../auth/useAuth";
import * as vitalsApiModule from "../api/vitals";
import * as doctorsApiModule from "../api/doctors";

vi.mock("../api/documents", () => ({
  listDocumentsForRecord: vi.fn().mockResolvedValue([]),
  uploadDocument: vi.fn(),
  deleteDocument: vi.fn(),
  getDownloadUrl: vi.fn().mockReturnValue("#"),
}));

vi.mock("../api/vitals", () => ({
  vitalsApi: { list: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../api/doctors", () => ({
  doctorsApi: { list: vi.fn().mockResolvedValue([]) },
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

describe("ProfilePage", () => {
  it("loads and shows existing profile", async () => {
    mockAuth("viewer");
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "1", full_name: "Jane Doe", date_of_birth: null, blood_type: "O+",
      allergies: null, emergency_contacts: null, primary_language: null, notes: null,
      height: null, weight: null, phone: null,
    });
    render(<ProfilePage />);
    await waitFor(() => expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe("Jane Doe"));
  });

  it("viewer has no Save button", async () => {
    mockAuth("viewer");
    vi.spyOn(profileApi, "getProfile").mockResolvedValue(null);
    render(<ProfilePage />);
    await screen.findByLabelText("Full name");
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
  });

  it("admin can save the profile", async () => {
    mockAuth("admin");
    vi.spyOn(profileApi, "getProfile").mockResolvedValue(null);
    const save = vi.spyOn(profileApi, "saveProfile").mockResolvedValue({
      id: "1", full_name: "Jane Doe", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: null, primary_language: null, notes: null,
      height: null, weight: null, phone: null,
    });
    render(<ProfilePage />);
    fireEvent.change(await screen.findByLabelText("Full name"), { target: { value: "Jane Doe" } });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ full_name: "Jane Doe" })));
  });
});

describe("Emergency contact cards", () => {
  it("shows Add Contact button for admin with no contacts", async () => {
    mockAuth("admin");
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: null, primary_language: null,
      height: null, weight: null, phone: null, notes: null,
    });
    render(<ProfilePage />);
    await waitFor(() => expect(screen.getByText("+ Add Contact")).toBeInTheDocument());
  });

  it("renders existing contact card from JSON", async () => {
    mockAuth("admin");
    const contacts = JSON.stringify([
      { name: "Alice Smith", relationship: "Spouse/Partner", phone: "555-1234", email: "alice@example.com" }
    ]);
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: contacts, primary_language: null,
      height: null, weight: null, phone: null, notes: null,
    });
    render(<ProfilePage />);
    await waitFor(() => {
      expect((screen.getByDisplayValue("Alice Smith") as HTMLInputElement).value).toBe("Alice Smith");
      expect((screen.getByDisplayValue("555-1234") as HTMLInputElement).value).toBe("555-1234");
    });
  });

  it("viewer sees read-only contact display, no Add button", async () => {
    mockAuth("viewer");
    const contacts = JSON.stringify([
      { name: "Bob", relationship: "Parent", phone: "555-0000", email: "" }
    ]);
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: contacts, primary_language: null,
      height: null, weight: null, phone: null, notes: null,
    });
    render(<ProfilePage />);
    await waitFor(() => expect(screen.getByText("Bob")).toBeInTheDocument());
    expect(screen.queryByText("+ Add Contact")).not.toBeInTheDocument();
  });

  it("saves contacts as JSON in emergency_contacts field", async () => {
    mockAuth("admin");
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: null, primary_language: null,
      height: null, weight: null, phone: null, notes: null,
    });
    const save = vi.spyOn(profileApi, "saveProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: null, primary_language: null,
      height: null, weight: null, phone: null, notes: null,
    });
    render(<ProfilePage />);
    fireEvent.click(await screen.findByText("+ Add Contact"));
    fireEvent.change(screen.getAllByPlaceholderText("Name")[0], { target: { value: "Carol" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => {
      const callArg = save.mock.calls[0][0];
      const parsed = JSON.parse(callArg.emergency_contacts as string);
      expect(parsed[0].name).toBe("Carol");
    });
  });

  it("handles malformed JSON contact objects without crashing on save", async () => {
    mockAuth("admin");
    // Stored JSON has a contact missing the phone field
    const malformed = JSON.stringify([{ name: "Alice", relationship: "Parent" }]);
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: malformed, primary_language: null,
      height: null, weight: null, phone: null, notes: null,
    });
    const save = vi.spyOn(profileApi, "saveProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: null, primary_language: null,
      height: null, weight: null, phone: null, notes: null,
    });
    render(<ProfilePage />);
    await waitFor(() => expect(screen.getByDisplayValue("Alice")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    // No error shown — save succeeded
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("filters out empty contacts on save", async () => {
    mockAuth("admin");
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: null, primary_language: null,
      height: null, weight: null, phone: null, notes: null,
    });
    const save = vi.spyOn(profileApi, "saveProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: null, primary_language: null,
      height: null, weight: null, phone: null, notes: null,
    });
    render(<ProfilePage />);
    // Add a blank contact and immediately save — blank card should not appear in payload
    fireEvent.click(await screen.findByText("+ Add Contact"));
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => {
      const callArg = save.mock.calls[0][0];
      expect(callArg.emergency_contacts).toBeNull();
    });
  });
});

describe("Height/Weight Vitals prefill", () => {
  it("shows vitals hint when profile has no height and vitals has height_in", async () => {
    mockAuth("admin");
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: null, primary_language: null,
      height: null, weight: null, phone: null, notes: null,
    });
    vi.spyOn(vitalsApiModule.vitalsApi, "list").mockResolvedValue([
      {
        id: "v1", measured_at: "2026-06-18T10:00:00Z",
        bp_systolic: null, bp_diastolic: null, pulse_bpm: null,
        height_in: 70, weight_lb: 175,
        temperature_f: null, respiratory_rate: null, spo2: null, blood_glucose: null,
        notes: null, visit_log_id: null, bmi: null,
      },
    ]);
    render(<ProfilePage />);
    await waitFor(() => {
      expect(screen.getByText(/Latest from Vitals:.*5'10"/i)).toBeInTheDocument();
      expect(screen.getByText(/Latest from Vitals:.*175 lbs/i)).toBeInTheDocument();
    });
  });

  it("prefills height field from vitals when profile height is null", async () => {
    mockAuth("admin");
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: null, primary_language: null,
      height: null, weight: null, phone: null, notes: null,
    });
    vi.spyOn(vitalsApiModule.vitalsApi, "list").mockResolvedValue([
      {
        id: "v1", measured_at: "2026-06-18T10:00:00Z",
        bp_systolic: null, bp_diastolic: null, pulse_bpm: null,
        height_in: 66, weight_lb: null,
        temperature_f: null, respiratory_rate: null, spo2: null, blood_glucose: null,
        notes: null, visit_log_id: null, bmi: null,
      },
    ]);
    render(<ProfilePage />);
    await waitFor(() => {
      expect((screen.getByLabelText("Height") as HTMLInputElement).value).toBe("5'6\"");
    });
  });

  it("keeps profile height value and still shows hint when profile already has height", async () => {
    mockAuth("admin");
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: null, primary_language: null,
      height: "5'9\"", weight: null, phone: null, notes: null,
    });
    vi.spyOn(vitalsApiModule.vitalsApi, "list").mockResolvedValue([
      {
        id: "v1", measured_at: "2026-06-18T10:00:00Z",
        bp_systolic: null, bp_diastolic: null, pulse_bpm: null,
        height_in: 70, weight_lb: null,
        temperature_f: null, respiratory_rate: null, spo2: null, blood_glucose: null,
        notes: null, visit_log_id: null, bmi: null,
      },
    ]);
    render(<ProfilePage />);
    await waitFor(() => {
      expect((screen.getByLabelText("Height") as HTMLInputElement).value).toBe("5'9\"");
      expect(screen.getByText(/Latest from Vitals:.*5'10"/i)).toBeInTheDocument();
    });
  });

  it("shows no hint when no vitals entry has height or weight", async () => {
    mockAuth("admin");
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: null, primary_language: null,
      height: null, weight: null, phone: null, notes: null,
    });
    vi.spyOn(vitalsApiModule.vitalsApi, "list").mockResolvedValue([]);
    render(<ProfilePage />);
    await waitFor(() => screen.getByLabelText("Height"));
    expect(screen.queryByText(/Latest from Vitals/i)).not.toBeInTheDocument();
  });

  it("converts fractional inches correctly at foot boundary", async () => {
    mockAuth("admin");
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: null, primary_language: null,
      height: null, weight: null, phone: null, notes: null,
    });
    vi.spyOn(vitalsApiModule.vitalsApi, "list").mockResolvedValue([
      {
        id: "v1", measured_at: "2026-06-18T10:00:00Z",
        bp_systolic: null, bp_diastolic: null, pulse_bpm: null,
        height_in: 71.5, weight_lb: null,
        temperature_f: null, respiratory_rate: null, spo2: null, blood_glucose: null,
        notes: null, visit_log_id: null, bmi: null,
      },
    ]);
    render(<ProfilePage />);
    await waitFor(() => {
      expect((screen.getByLabelText("Height") as HTMLInputElement).value).toBe("6'0\"");
    });
  });
});

describe("Allergy cards", () => {
  it("shows Add Allergy button for admin with no allergies", async () => {
    mockAuth("admin");
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: null, primary_language: null,
      height: null, weight: null, phone: null, notes: null,
    });
    render(<ProfilePage />);
    await waitFor(() => expect(screen.getByText("+ Add Allergy")).toBeInTheDocument());
  });

  it("renders existing allergy card from JSON", async () => {
    mockAuth("admin");
    const stored = JSON.stringify([
      { medication: "Penicillin", reaction: "Hives", age_of_onset: "12" }
    ]);
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: stored, emergency_contacts: null, primary_language: null,
      height: null, weight: null, phone: null, notes: null,
    });
    render(<ProfilePage />);
    await waitFor(() => {
      expect((screen.getByDisplayValue("Penicillin") as HTMLInputElement).value).toBe("Penicillin");
      expect((screen.getByDisplayValue("Hives") as HTMLInputElement).value).toBe("Hives");
      expect((screen.getByDisplayValue("12") as HTMLInputElement).value).toBe("12");
    });
  });

  it("viewer sees read-only allergy display, no Add button", async () => {
    mockAuth("viewer");
    const stored = JSON.stringify([
      { medication: "Aspirin", reaction: "Rash", age_of_onset: "30" }
    ]);
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: stored, emergency_contacts: null, primary_language: null,
      height: null, weight: null, phone: null, notes: null,
    });
    render(<ProfilePage />);
    await waitFor(() => expect(screen.getByText("Aspirin")).toBeInTheDocument());
    expect(screen.queryByText("+ Add Allergy")).not.toBeInTheDocument();
  });

  it("saves allergies as JSON in allergies field", async () => {
    mockAuth("admin");
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: null, primary_language: null,
      height: null, weight: null, phone: null, notes: null,
    });
    const save = vi.spyOn(profileApi, "saveProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: null, primary_language: null,
      height: null, weight: null, phone: null, notes: null,
    });
    render(<ProfilePage />);
    fireEvent.click(await screen.findByText("+ Add Allergy"));
    fireEvent.change(screen.getByPlaceholderText("Medication"), { target: { value: "Sulfa" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => {
      const callArg = save.mock.calls[0][0];
      const parsed = JSON.parse(callArg.allergies as string);
      expect(parsed[0].medication).toBe("Sulfa");
    });
  });

  it("filters out empty allergy cards on save", async () => {
    mockAuth("admin");
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: null, primary_language: null,
      height: null, weight: null, phone: null, notes: null,
    });
    const save = vi.spyOn(profileApi, "saveProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: null, primary_language: null,
      height: null, weight: null, phone: null, notes: null,
    });
    render(<ProfilePage />);
    fireEvent.click(await screen.findByText("+ Add Allergy"));
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => {
      const callArg = save.mock.calls[0][0];
      expect(callArg.allergies).toBeNull();
    });
  });

  it("falls back to empty list when allergies contains legacy free-text", async () => {
    mockAuth("viewer");
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: "Penicillin, Sulfa", emergency_contacts: null, primary_language: null,
      height: null, weight: null, phone: null, notes: null,
    });
    render(<ProfilePage />);
    await waitFor(() => screen.getByLabelText("Full name"));
    expect(screen.getByText("No allergies on file.")).toBeInTheDocument();
  });
});

describe("Main Doctor field", () => {
  it("admin sees Main Doctor dropdown with doctor options", async () => {
    mockAuth("admin");
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: null, primary_language: null,
      height: null, weight: null, phone: null, notes: null, main_doctor_id: null,
    });
    vi.spyOn(doctorsApiModule.doctorsApi, "list").mockResolvedValue([
      { id: "d1", name: "Dr. Smith", specialty: "Cardiology", practice: null,
        phone: null, fax: null, address: null, patient_portal_url: null, notes: null },
    ]);
    render(<ProfilePage />);
    await waitFor(() => expect(screen.getByLabelText("Main Doctor")).toBeInTheDocument());
    expect(screen.getByRole("option", { name: /Dr\. Smith/ })).toBeInTheDocument();
  });

  it("viewer sees Main Doctor as read-only text", async () => {
    mockAuth("viewer");
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: null, primary_language: null,
      height: null, weight: null, phone: null, notes: null, main_doctor_id: "d1",
    });
    vi.spyOn(doctorsApiModule.doctorsApi, "list").mockResolvedValue([
      { id: "d1", name: "Dr. Smith", specialty: "Cardiology", practice: null,
        phone: null, fax: null, address: null, patient_portal_url: null, notes: null },
    ]);
    render(<ProfilePage />);
    await waitFor(() => expect(screen.getByText(/Dr\. Smith/)).toBeInTheDocument());
    expect(screen.queryByLabelText("Main Doctor")).not.toBeInTheDocument();
  });

  it("saving profile includes main_doctor_id in payload", async () => {
    mockAuth("admin");
    vi.spyOn(profileApi, "getProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: null, primary_language: null,
      height: null, weight: null, phone: null, notes: null, main_doctor_id: null,
    });
    vi.spyOn(doctorsApiModule.doctorsApi, "list").mockResolvedValue([
      { id: "d1", name: "Dr. Smith", specialty: "Cardiology", practice: null,
        phone: null, fax: null, address: null, patient_portal_url: null, notes: null },
    ]);
    const save = vi.spyOn(profileApi, "saveProfile").mockResolvedValue({
      id: "1", full_name: "Jane", date_of_birth: null, blood_type: null,
      allergies: null, emergency_contacts: null, primary_language: null,
      height: null, weight: null, phone: null, notes: null, main_doctor_id: "d1",
    });
    render(<ProfilePage />);
    const select = await screen.findByLabelText("Main Doctor");
    fireEvent.change(select, { target: { value: "d1" } });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => {
      expect(save.mock.calls[0][0].main_doctor_id).toBe("d1");
    });
  });
});
