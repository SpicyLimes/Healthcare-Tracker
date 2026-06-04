import { createRecordClient } from "./records";

export interface DentalHistory {
  id: string;
  visit_date: string | null;
  provider_id: string | null;
  provider_other: string | null;
  procedure: string | null;
  notes: string | null;
}

export interface DentalHistoryInput {
  visit_date?: string | null;
  provider_id?: string | null;
  provider_other?: string | null;
  procedure?: string | null;
  notes?: string | null;
}

export const dentalHistoryApi = createRecordClient<DentalHistory, DentalHistoryInput, DentalHistoryInput>("/api/dental-history");
