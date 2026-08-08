import { createRecordClient } from "./records";

export type AppointmentStatus = "upcoming" | "completed" | "cancelled" | "rescheduled";
export type AppointmentType = "annual_checkup" | "follow_up" | "specialist" | "lab" | "imaging" | "dental" | "vision" | "other";

/**
 * Display labels for appointment types, beside the type they describe.
 *
 * This list was written out three times — CalendarPage, GuestSectionPage, and
 * the orphaned AppointmentsPage — so a ninth type meant finding all three.
 */
export const APPOINTMENT_TYPES: { value: AppointmentType; label: string }[] = [
  { value: "annual_checkup", label: "Annual Checkup" },
  { value: "follow_up", label: "Follow-up" },
  { value: "specialist", label: "Specialist" },
  { value: "lab", label: "Lab/Blood Work" },
  { value: "imaging", label: "Imaging" },
  { value: "dental", label: "Dental" },
  { value: "vision", label: "Vision" },
  { value: "other", label: "Other" },
];

export function appointmentTypeLabel(t: AppointmentType | string | null): string {
  if (!t) return "";
  return APPOINTMENT_TYPES.find((x) => x.value === t)?.label ?? "";
}

export interface Appointment {
  id: string;
  appointment_datetime: string;
  appointment_type: AppointmentType | null;
  doctor_id: string | null;
  doctor_other: string | null;
  location: string | null;
  reason: string | null;
  status: AppointmentStatus;
  notes: string | null;
  visit_log_id: string | null;
}

export interface AppointmentInput {
  appointment_datetime: string;
  appointment_type?: AppointmentType | null;
  doctor_id?: string | null;
  doctor_other?: string | null;
  location?: string | null;
  reason?: string | null;
  status?: AppointmentStatus;
  notes?: string | null;
}

export const appointmentsApi = createRecordClient<Appointment, AppointmentInput, AppointmentInput>("/api/appointments");
