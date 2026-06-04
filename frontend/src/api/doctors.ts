import { createRecordClient } from "./records";

export interface Doctor {
  id: string;
  name: string;
  specialty: string | null;
  practice: string | null;
  phone: string | null;
  fax: string | null;
  address: string | null;
  patient_portal_url: string | null;
  notes: string | null;
}

export interface DoctorInput {
  name: string;
  specialty?: string | null;
  practice?: string | null;
  phone?: string | null;
  fax?: string | null;
  address?: string | null;
  patient_portal_url?: string | null;
  notes?: string | null;
}

export const doctorsApi = createRecordClient<Doctor, DoctorInput, DoctorInput>("/api/doctors");
