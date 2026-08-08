// frontend/src/api/calendar.ts
import { apiFetch } from "./client";

export type CalendarEventType =
  | "appointment"
  | "visit_log"
  | "vaccination"
  | "surgery"
  | "hospitalization"
  | "medication"
  | "follow_up";

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

// Must match COLORS in backend/app/routers/calendar.py. Darkened to the
// -600/-700 steps so white chip text clears WCAG AA at the month grid's 10px
// size — the -500 steps ranged 1.92:1 to 4.23:1, all failing.
export const EVENT_COLORS: Record<CalendarEventType, string> = {
  appointment: "#1d4ed8",
  visit_log: "#6d28d9",
  vaccination: "#047857",
  surgery: "#b91c1c",
  hospitalization: "#c2410c",
  medication: "#a16207",
  follow_up: "#0f766e",
};

export const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  appointment: "Appointment",
  visit_log: "Visit Log",
  vaccination: "Vaccination",
  surgery: "Procedure",
  hospitalization: "Hospitalization",
  medication: "Medication",
  follow_up: "Follow-up",
};

export const calendarApi = {
  async list(): Promise<CalendarEvent[]> {
    const res = await apiFetch("/api/calendar/events");
    if (!res.ok) throw new Error("Failed to load calendar events");
    return (await res.json()) as CalendarEvent[];
  },
};
