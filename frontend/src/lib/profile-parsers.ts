export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email: string;
  is_poa: boolean;
  doc_ids: number[];
}

export function parseContacts(raw: string | null | undefined): EmergencyContact[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        name:         typeof item.name         === "string"  ? item.name         : "",
        relationship: typeof item.relationship === "string"  ? item.relationship : "",
        phone:        typeof item.phone        === "string"  ? item.phone        : "",
        email:        typeof item.email        === "string"  ? item.email        : "",
        is_poa:       typeof item.is_poa       === "boolean" ? item.is_poa       : false,
        doc_ids:      Array.isArray(item.doc_ids) ? (item.doc_ids as unknown[]).filter((x): x is number => typeof x === "number") : [],
      }));
    }
  } catch {
    // legacy free-text — discard
  }
  return [];
}

export interface Allergy {
  medication: string;
  reaction: string;
  age_of_onset: string;
}

export function parseAllergies(raw: string | null | undefined): Allergy[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => ({
        medication:   typeof item.medication   === "string" ? item.medication   : "",
        reaction:     typeof item.reaction     === "string" ? item.reaction     : "",
        age_of_onset: typeof item.age_of_onset === "string" ? item.age_of_onset : "",
      }));
    }
  } catch {
    // legacy free-text — discard
  }
  return [];
}
