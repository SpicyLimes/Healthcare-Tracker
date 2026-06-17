import { createRecordClient } from "./records";

export interface Vitals {
  id: string;
  measured_at: string;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  pulse_bpm: number | null;
  height_in: number | null;
  weight_lb: number | null;
  temperature_f: number | null;
  respiratory_rate: number | null;
  spo2: number | null;
  blood_glucose: number | null;
  notes: string | null;
  visit_log_id: string | null;
  bmi: number | null;
}

export interface VitalsInput {
  measured_at?: string;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  pulse_bpm?: number | null;
  height_in?: number | null;
  weight_lb?: number | null;
  temperature_f?: number | null;
  respiratory_rate?: number | null;
  spo2?: number | null;
  blood_glucose?: number | null;
  notes?: string | null;
  visit_log_id?: string | null;
}

export const vitalsApi = createRecordClient<Vitals, VitalsInput, VitalsInput>("/api/vitals");
