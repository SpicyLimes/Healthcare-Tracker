import { createRecordClient } from "./records";

export const VISIT_TYPES = [
  { value: "in_person", label: "In-Person" },
  { value: "phone_call", label: "Phone Call" },
  { value: "telehealth", label: "Telehealth" },
  { value: "other", label: "Other" },
] as const;

export const VISIT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  VISIT_TYPES.map((t) => [t.value, t.label])
);

export interface VisitLog {
  id: string;
  visit_type: string;
  visit_date: string | null;
  visit_time: string | null;
  doctor_id: string | null;
  doctor_other: string | null;
  reason: string | null;
  summary: string | null;
  follow_up: string | null;
  follow_up_date: string | null;
  notes: string | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  pulse_bpm: number | null;
  height_in: number | null;
  weight_lb: number | null;
  temperature_f: number | null;
  respiratory_rate: number | null;
  spo2: number | null;
  blood_glucose: number | null;
  linked_vitals_id: string | null;
}

export interface VisitLogInput {
  visit_type?: string;
  visit_date?: string | null;
  visit_time?: string | null;
  doctor_id?: string | null;
  doctor_other?: string | null;
  reason?: string | null;
  summary?: string | null;
  follow_up?: string | null;
  follow_up_date?: string | null;
  notes?: string | null;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  pulse_bpm?: number | null;
  height_in?: number | null;
  weight_lb?: number | null;
  temperature_f?: number | null;
  respiratory_rate?: number | null;
  spo2?: number | null;
  blood_glucose?: number | null;
}

export const visitLogsApi = createRecordClient<VisitLog, VisitLogInput, VisitLogInput>("/api/visit-logs");
