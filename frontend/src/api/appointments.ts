import { createRecordClient } from "./records";

export type AppointmentStatus = "upcoming" | "completed" | "cancelled" | "rescheduled";
export type AppointmentType = "annual_checkup" | "follow_up" | "specialist" | "lab" | "imaging" | "dental" | "vision" | "other";

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
