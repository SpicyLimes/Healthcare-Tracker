import { apiFetch } from "./client";
import { csrfHeader } from "./csrf";

export interface Profile {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  blood_type: string | null;
  allergies: string | null;
  emergency_contacts: string | null;
  primary_language: string | null;
  notes: string | null;
}

export interface ProfileInput {
  full_name: string;
  date_of_birth?: string | null;
  blood_type?: string | null;
  allergies?: string | null;
  emergency_contacts?: string | null;
  primary_language?: string | null;
  notes?: string | null;
}

/** Returns the profile, or null if it has not been set yet (404). */
export async function getProfile(): Promise<Profile | null> {
  const res = await apiFetch("/api/profile");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to load profile");
  return (await res.json()) as Profile;
}

export async function saveProfile(data: ProfileInput): Promise<Profile> {
  const res = await apiFetch("/api/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...csrfHeader() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save profile");
  return (await res.json()) as Profile;
}
