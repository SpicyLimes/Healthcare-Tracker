import { describe, it, expect } from "vitest";
import { SECTION_LABELS, ALL_SECTIONS, sectionLabel } from "./section-labels";

/**
 * These labels must match SECTION_TITLES in
 * backend/app/services/summary_service.py. If you change one, change both —
 * otherwise the printout names a section differently from the UI that built it.
 */
const BACKEND_SECTION_TITLES: Record<string, string> = {
  medications: "Medications",
  doctors: "Doctors",
  ailments: "Ailment History",
  profile: "Profile",
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
};

describe("section labels", () => {
  it("agrees with the backend on every section", () => {
    for (const [key, title] of Object.entries(BACKEND_SECTION_TITLES)) {
      expect(SECTION_LABELS[key], `section '${key}'`).toBe(title);
    }
  });

  it("covers every section the app lists", () => {
    for (const s of ALL_SECTIONS) {
      expect(SECTION_LABELS[s], `missing label for '${s}'`).toBeTruthy();
    }
  });

  it("uses the curated label, never a title-cased key", () => {
    // The ShareLinksPage regression: title-casing produced "Ailments" and
    // "Insurances" while every other surface said otherwise.
    expect(sectionLabel("ailments")).toBe("Ailment History");
    expect(sectionLabel("insurances")).toBe("Insurance");
    expect(sectionLabel("surgeries")).toBe("Procedures");
    expect(sectionLabel("visit_logs")).toBe("Visit & Call Logs");
  });

  it("falls back gracefully for an unknown section", () => {
    expect(sectionLabel("some_new_thing")).toBe("Some New Thing");
  });
});
