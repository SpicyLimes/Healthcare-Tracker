import { createRecordClient } from "./records";

export interface Insurance {
  id: string;
  insurer_name: string;
  policy_number: string | null;
  group_number: string | null;
  contact_phone: string | null;
  contact_address: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface InsuranceInput {
  insurer_name: string;
  policy_number?: string | null;
  group_number?: string | null;
  contact_phone?: string | null;
  contact_address?: string | null;
  notes?: string | null;
  is_active?: boolean;
}

export const insurancesApi = createRecordClient<Insurance, InsuranceInput, InsuranceInput>("/api/insurances");
