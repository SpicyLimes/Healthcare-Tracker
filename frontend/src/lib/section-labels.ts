/**
 * Canonical display labels for record sections.
 *
 * Mirrors SECTION_TITLES in backend/app/services/summary_service.py — the two
 * must agree, or the same section is named differently on the printout and in
 * the UI that built it. Import this; do not re-derive labels by title-casing
 * the key, which is how ShareLinksPage came to show "Ailments" and
 * "Insurances" while every other surface said "Ailment History"/"Insurance".
 */
export const SECTION_LABELS: Record<string, string> = {
  doctors: "Doctors",
  medications: "Medications",
  ailments: "Ailment History",
  surgeries: "Procedures",
  hospitalizations: "Hospitalizations",
  vision_history: "Vision History",
  dental_history: "Dental History",
  visit_logs: "Visit & Call Logs",
  vitals: "Vitals",
  appointments: "Appointments",
  vaccinations: "Vaccinations",
  insurances: "Insurance",
  pharmacies: "Pharmacies",
  family_history: "Family History",
  nutrition_plan: "Nutrition Plan",
  profile: "Profile",
};

/** Every section key, in the order the app presents them. */
export const ALL_SECTIONS: string[] = [
  "doctors", "appointments", "medications", "ailments", "surgeries",
  "hospitalizations", "vaccinations", "vision_history", "dental_history",
  "visit_logs", "vitals", "insurances", "pharmacies", "family_history",
  "nutrition_plan", "profile",
];

/**
 * Clinical reading order, most-consequential first.
 *
 * Allergies live on the profile, and medications drive interaction checks —
 * HL7 C-CDA, ISO 27269 IPS and AHRQ all put those two first. Used to pick the
 * guest landing section and to order the guest nav, so a shared link opens on
 * something clinically useful instead of whichever checkbox was clicked first.
 */
export const CLINICAL_ORDER: string[] = [
  "profile", "medications", "ailments", "vitals", "visit_logs", "appointments",
  "surgeries", "hospitalizations", "vaccinations", "doctors", "vision_history",
  "dental_history", "insurances", "pharmacies", "family_history", "nutrition_plan",
];

/** Sort sections into clinical reading order; unknown keys go last, stable. */
export function sortByClinicalOrder(sections: string[]): string[] {
  const rank = (s: string) => {
    const i = CLINICAL_ORDER.indexOf(s);
    return i === -1 ? CLINICAL_ORDER.length : i;
  };
  return [...sections].sort((a, b) => rank(a) - rank(b));
}

/** The section a guest should land on: highest clinical value they can see. */
export function landingSection(allowed: string[]): string | undefined {
  return sortByClinicalOrder(allowed)[0];
}

/** Label for a section key, falling back to a humanised form if unknown. */
export function sectionLabel(section: string): string {
  return (
    SECTION_LABELS[section] ??
    section.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
