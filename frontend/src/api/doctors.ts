import { createRecordClient } from "./records";
import { apiFetch } from "./client";

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

/** One record linked to a doctor. */
export interface RelatedItem {
  id: string;
  title: string;
  date: string | null;
}

/** Records linked to a doctor through a single clinical role. */
export interface RelatedGroup {
  role: string;
  section: string;
  count: number;
  items: RelatedItem[];
}

export async function getRelatedRecords(doctorId: string): Promise<RelatedGroup[]> {
  const res = await apiFetch(`/api/doctors/${doctorId}/related`);
  if (!res.ok) throw new Error("Failed to load related records");
  return res.json();
}
