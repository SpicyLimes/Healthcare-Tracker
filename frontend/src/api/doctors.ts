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

/**
 * Display label for a doctor: "Name (Specialty) — Practice".
 *
 * Two doctors can share a name, so a bare name is ambiguous exactly where it
 * matters most — picking a prescriber or surgeon. Specialty and practice are
 * appended only when set, so a sparse record still reads as just the name.
 */
export function doctorLabel(d: Pick<Doctor, "name" | "specialty" | "practice">): string {
  const withSpecialty = d.specialty ? `${d.name} (${d.specialty})` : d.name;
  return d.practice ? `${withSpecialty} — ${d.practice}` : withSpecialty;
}

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
