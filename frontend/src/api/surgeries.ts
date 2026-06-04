import { createRecordClient } from "./records";

export interface Surgery {
  id: string;
  procedure: string;
  surgery_date: string | null;
  surgeon_id: string | null;
  surgeon_other: string | null;
  hospital: string | null;
  outcome: string | null;
  notes: string | null;
}

export interface SurgeryInput {
  procedure: string;
  surgery_date?: string | null;
  surgeon_id?: string | null;
  surgeon_other?: string | null;
  hospital?: string | null;
  outcome?: string | null;
  notes?: string | null;
}

export const surgeriesApi = createRecordClient<Surgery, SurgeryInput, SurgeryInput>("/api/surgeries");
