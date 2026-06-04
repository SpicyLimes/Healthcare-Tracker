import { createRecordClient } from "./records";

export interface FamilyHistory {
  id: string;
  relative: string;
  condition: string;
  age_of_onset: string | null;
  notes: string | null;
}

export interface FamilyHistoryInput {
  relative: string;
  condition: string;
  age_of_onset?: string | null;
  notes?: string | null;
}

export const familyHistoryApi = createRecordClient<FamilyHistory, FamilyHistoryInput, FamilyHistoryInput>("/api/family-history");
