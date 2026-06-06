import { createRecordClient } from "./records";

export type MedicationKind = "medication" | "vitamin" | "supplement";

export interface Medication {
  id: string;
  name: string;
  kind: MedicationKind;
  dose: string | null;
  frequency: string | null;
  route: string | null;
  prescribing_doctor: string | null;
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
  route?: string | null;
  prescribing_doctor?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export const medicationsApi = createRecordClient<Medication, MedicationInput, MedicationInput>(
  "/api/medications",
);
