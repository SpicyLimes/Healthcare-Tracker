import { createRecordClient } from "./records";

export type MedicationKind = "medication" | "vitamin" | "supplement";

export interface Medication {
  id: string;
  name: string;
  kind: MedicationKind;
  dose: string | null;
  frequency: string | null;
  /** What the medication treats, e.g. "ADD/ADHD". Shown to guests; notes are not. */
  used_for: string | null;
  route: string | null;
  prescribing_doctor: string | null;
  prescribing_doctor_id: string | null;
  pharmacy_id: string | null;
  pharmacy_name: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  notes: string | null;
}

export interface MedicationInput {
  name: string;
  kind?: MedicationKind;
  dose?: string | null;
  frequency?: string | null;
  used_for?: string | null;
  route?: string | null;
  prescribing_doctor?: string | null;
  prescribing_doctor_id?: string | null;
  pharmacy_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export const medicationsApi = createRecordClient<Medication, MedicationInput, MedicationInput>(
  "/api/medications",
);
