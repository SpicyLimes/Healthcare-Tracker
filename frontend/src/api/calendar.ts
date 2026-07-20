// frontend/src/api/calendar.ts
import { apiFetch } from "./client";

export type CalendarEventType =
  | "appointment"
  | "visit_log"
  | "vaccination"
  | "surgery"
  | "hospitalization"
  | "medication";

export interface CalendarEvent {
  id: string;
  type: CalendarEventType;
  title: string;
  date: string;       // YYYY-MM-DD
  end_date?: string;
  color: string;
  doctor_name?: string | null;  // appointments only
  time?: string | null;         // HH:MM UTC, appointments only
}

export const EVENT_COLORS: Record<CalendarEventType, string> = {
  appointment: "#3b82f6",
  visit_log: "#8b5cf6",
  vaccination: "#10b981",
  surgery: "#ef4444",
  hospitalization: "#f97316",
  medication: "#eab308",
};

export const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  appointment: "Appointment",
  visit_log: "Visit Log",
  vaccination: "Vaccination",
  surgery: "Procedure",
  hospitalization: "Hospitalization",
  medication: "Medication",
};

export const calendarApi = {
  async list(): Promise<CalendarEvent[]> {
    const res = await apiFetch("/api/calendar/events");
    if (!res.ok) throw new Error("Failed to load calendar events");
    return (await res.json()) as CalendarEvent[];
  },
};
