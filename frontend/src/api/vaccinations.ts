import { createRecordClient } from "./records";

export interface Vaccination {
  id: string;
  vaccine: string;
  administered_date: string | null;
  lot_number: string | null;
  administrator: string | null;
  next_due_date: string | null;
  notes: string | null;
}

export interface VaccinationInput {
  vaccine: string;
  administered_date?: string | null;
  lot_number?: string | null;
  administrator?: string | null;
  next_due_date?: string | null;
  notes?: string | null;
}

export const vaccinationsApi = createRecordClient<Vaccination, VaccinationInput, VaccinationInput>("/api/vaccinations");
