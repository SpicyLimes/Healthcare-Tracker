import { createRecordClient } from "./records";

export interface Pharmacy {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  fax: string | null;
  notes: string | null;
}

export interface PharmacyInput {
  name: string;
  address?: string | null;
  phone?: string | null;
  fax?: string | null;
  notes?: string | null;
}

export const pharmaciesApi = createRecordClient<Pharmacy, PharmacyInput, PharmacyInput>("/api/pharmacies");
