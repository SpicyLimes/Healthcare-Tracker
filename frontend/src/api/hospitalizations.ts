import { createRecordClient } from "./records";

export interface Hospitalization {
  id: string;
  facility: string;
  admission_date: string | null;
  discharge_date: string | null;
  reason: string | null;
  attending_physician_id: string | null;
  attending_physician_other: string | null;
  outcome: string | null;
  notes: string | null;
}

export interface HospitalizationInput {
  facility: string;
  admission_date?: string | null;
  discharge_date?: string | null;
  reason?: string | null;
  attending_physician_id?: string | null;
  attending_physician_other?: string | null;
  outcome?: string | null;
  notes?: string | null;
}

export const hospitalizationsApi = createRecordClient<Hospitalization, HospitalizationInput, HospitalizationInput>("/api/hospitalizations");
