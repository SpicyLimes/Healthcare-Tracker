import { createRecordClient } from "./records";

export type AppointmentStatus = "upcoming" | "completed" | "cancelled" | "rescheduled";

export interface Appointment {
  id: string;
  appointment_datetime: string;
  doctor_id: string | null;
  doctor_other: string | null;
  location: string | null;
  reason: string | null;
  status: AppointmentStatus;
  notes: string | null;
}

export interface AppointmentInput {
  appointment_datetime: string;
  doctor_id?: string | null;
  doctor_other?: string | null;
  location?: string | null;
  reason?: string | null;
  status?: AppointmentStatus;
  notes?: string | null;
}

export const appointmentsApi = createRecordClient<Appointment, AppointmentInput, AppointmentInput>("/api/appointments");
