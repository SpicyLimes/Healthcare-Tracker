import { createRecordClient } from "./records";

export const PROCEDURE_TYPES = [
  { value: "surgery", label: "Surgery" },
  { value: "outpatient", label: "Out-Patient" },
  { value: "clinic", label: "Clinic" },
] as const;

export const PROCEDURE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  PROCEDURE_TYPES.map((t) => [t.value, t.label])
);

export interface Surgery {
  id: string;
  procedure: string;
  procedure_type: string;
  surgery_date: string | null;
  surgeon_id: string | null;
  surgeon_other: string | null;
  hospital: string | null;
  outcome: string | null;
  notes: string | null;
}

export interface SurgeryInput {
  procedure: string;
  procedure_type?: string;
  surgery_date?: string | null;
  surgeon_id?: string | null;
  surgeon_other?: string | null;
  hospital?: string | null;
  outcome?: string | null;
  notes?: string | null;
}

export const surgeriesApi = createRecordClient<Surgery, SurgeryInput, SurgeryInput>("/api/surgeries");
