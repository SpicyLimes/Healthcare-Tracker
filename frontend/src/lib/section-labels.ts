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

/** Label for a section key, falling back to a humanised form if unknown. */
export function sectionLabel(section: string): string {
  return (
    SECTION_LABELS[section] ??
    section.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
