import { describe, it, expect } from "vitest";
import {
  SECTION_LABELS, ALL_SECTIONS, sectionLabel,
  CLINICAL_ORDER, sortByClinicalOrder, landingSection, sectionRoute,
} from "./section-labels";

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

describe("clinical ordering", () => {
  it("lands a guest on the highest-value section they can see", () => {
    // Previously sections[0] — whichever checkbox the sender clicked first.
    expect(landingSection(["vision_history", "medications"])).toBe("medications");
    expect(landingSection(["nutrition_plan", "pharmacies", "profile"])).toBe("profile");
    expect(landingSection(["vitals"])).toBe("vitals");
  });

  it("returns undefined when nothing was shared", () => {
    expect(landingSection([])).toBeUndefined();
  });

  it("orders sections consistently regardless of input order", () => {
    const a = sortByClinicalOrder(["vaccinations", "medications", "profile"]);
    const b = sortByClinicalOrder(["profile", "vaccinations", "medications"]);
    expect(a).toEqual(b);
    expect(a).toEqual(["profile", "medications", "vaccinations"]);
  });

  it("puts unknown sections last instead of dropping them", () => {
    const out = sortByClinicalOrder(["mystery", "medications"]);
    expect(out).toEqual(["medications", "mystery"]);
  });

  it("agrees with the backend CANONICAL_ORDER", () => {
    // Mirrors CANONICAL_ORDER in summary_service.py.
    expect(CLINICAL_ORDER).toEqual([
      "profile", "medications", "ailments", "vitals", "visit_logs", "appointments",
      "surgeries", "hospitalizations", "vaccinations", "doctors", "vision_history",
      "dental_history", "insurances", "pharmacies", "family_history", "nutrition_plan",
    ]);
  });
});

describe("sectionRoute", () => {
  it("maps keys whose URL differs from the key", () => {
    // These two are why a per-page copy of this map kept going wrong.
    expect(sectionRoute("surgeries")).toBe("/procedures");
    expect(sectionRoute("visit_logs")).toBe("/doc-logs");
    expect(sectionRoute("insurances")).toBe("/insurance");
  });

  it("sends appointments to the calendar, which absorbed that page", () => {
    expect(sectionRoute("appointments")).toBe("/calendar");
  });

  it("returns undefined for a section with no page", () => {
    expect(sectionRoute("not_a_section")).toBeUndefined();
  });

  it("has a route for every labelled section", () => {
    for (const key of Object.keys(SECTION_LABELS)) {
      expect(sectionRoute(key), `no route for ${key}`).toBeDefined();
    }
  });
});
