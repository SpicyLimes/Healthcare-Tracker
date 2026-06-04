import { createRecordClient } from "./records";

export type AilmentStatus = "active" | "resolved";

export interface Ailment {
  id: string;
  condition: string;
  onset_date: string | null;
  status: AilmentStatus;
  treating_doctor: string | null;
  notes: string | null;
}

export interface AilmentInput {
  condition: string;
  onset_date?: string | null;
  status?: AilmentStatus;
  treating_doctor?: string | null;
  notes?: string | null;
}

export const ailmentsApi = createRecordClient<Ailment, AilmentInput, AilmentInput>("/api/ailments");
