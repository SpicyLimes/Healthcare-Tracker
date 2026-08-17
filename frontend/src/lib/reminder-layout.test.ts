import { describe, it, expect } from "vitest";
import {
  defaultLayout, medToCard, seedSectionFromMedications, seedAvoidFromFoods,
  moveItem, normalizeLayout, resolveTheme, THEMES,
} from "./reminder-layout";
import type { Medication } from "../api/medications";
import type { NutritionUnacceptableFood } from "../api/nutritionPlan";

const med = (over: Partial<Medication>): Medication => ({
  id: "1", name: "Aspirin", kind: "medication", used_for: null, dose: "81mg", frequency: "Once a day",
  route: null, prescribing_doctor: null, prescribing_doctor_id: null, pharmacy_id: null,
  pharmacy_name: null, start_date: null, end_date: null, is_active: true, notes: null, ...over,
});

const food = (name: string): NutritionUnacceptableFood => ({
  id: name, food_name: name, created_by: null, created_at: "", updated_at: "",
});

describe("defaultLayout", () => {
  it("returns the four themed sections", () => {
    expect(defaultLayout().sections.map((s) => s.theme)).toEqual(["morning", "midday", "evening", "asneeded"]);
  });

  it("returns a fresh copy each call", () => {
    const a = defaultLayout();
    a.sections[0].meds.push({ emoji: "X", name: "mutated", desc: "", badge: "" });
    expect(defaultLayout().sections[0].meds).toHaveLength(2);
  });
});

describe("resolveTheme", () => {
  it("resolves a preset key to its hex values", () => {
    const s = { ...defaultLayout().sections[0], theme: "evening" as const };
    expect(resolveTheme(s)).toEqual(THEMES.evening);
  });

  it("prefers customTheme when theme is custom", () => {
    const custom = { bg: "#000000", border: "#111111", title: "#222222" };
    const s = { ...defaultLayout().sections[0], theme: "custom" as const, customTheme: custom };
    expect(resolveTheme(s)).toEqual(custom);
  });

  it("falls back to morning when a theme key is unknown", () => {
    const s = { ...defaultLayout().sections[0], theme: "bogus" as never, customTheme: null };
    expect(resolveTheme(s)).toEqual(THEMES.morning);
  });
});

describe("medToCard", () => {
  it("joins dose and frequency with a middot", () => {
    expect(medToCard(med({})).desc).toBe("81mg · Once a day");
  });

  it("omits a missing dose without leaving a stray separator", () => {
    expect(medToCard(med({ dose: null })).desc).toBe("Once a day");
  });

  it("yields an empty desc when both dose and frequency are missing", () => {
    expect(medToCard(med({ dose: null, frequency: null })).desc).toBe("");
  });

  it("carries the medication name", () => {
    expect(medToCard(med({ name: "Zyrtec" })).name).toBe("Zyrtec");
  });
});

describe("seedSectionFromMedications", () => {
  it("appends one IMPORTED section holding the active meds", () => {
    const out = seedSectionFromMedications(defaultLayout(), [med({ id: "a", name: "NewDrug" })]);
    const imported = out.sections[out.sections.length - 1];
    expect(imported.name).toBe("IMPORTED");
    expect(imported.meds.map((m) => m.name)).toEqual(["NewDrug"]);
  });

  it("skips inactive medications", () => {
    const out = seedSectionFromMedications(defaultLayout(), [med({ id: "b", name: "Old", is_active: false })]);
    expect(out.sections[out.sections.length - 1].meds.map((m) => m.name)).not.toContain("Old");
  });

  it("flags a med already present in the layout as a possible duplicate", () => {
    const out = seedSectionFromMedications(defaultLayout(), [med({ name: "Aspirin" })]);
    const imported = out.sections[out.sections.length - 1];
    expect(imported.meds[0].badge).toBe("DUPLICATE?");
  });

  it("does not flag a med that is new to the layout", () => {
    const out = seedSectionFromMedications(defaultLayout(), [med({ name: "BrandNew" })]);
    expect(out.sections[out.sections.length - 1].meds[0].badge).toBe("");
  });

  it("does not mutate the input layout", () => {
    const before = defaultLayout();
    seedSectionFromMedications(before, [med({})]);
    expect(before.sections).toHaveLength(4);
  });

  it("adds no section when there are no active meds", () => {
    const out = seedSectionFromMedications(defaultLayout(), []);
    expect(out.sections).toHaveLength(4);
  });
});

describe("seedAvoidFromFoods", () => {
  it("appends foods to the avoid list", () => {
    const out = seedAvoidFromFoods(defaultLayout(), [food("Peanuts")]);
    expect(out.avoid.map((a) => a.text)).toContain("Peanuts");
  });

  it("skips a food already listed, case-insensitively", () => {
    const base = defaultLayout();
    const out = seedAvoidFromFoods(base, [food(base.avoid[0].text.toUpperCase())]);
    expect(out.avoid).toHaveLength(base.avoid.length);
  });

  it("does not mutate the input layout", () => {
    const before = defaultLayout();
    seedAvoidFromFoods(before, [food("Peanuts")]);
    expect(before.avoid).toHaveLength(2);
  });
});

describe("moveItem", () => {
  it("moves an item up", () => {
    expect(moveItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
  });

  it("moves an item down", () => {
    expect(moveItem(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
  });

  it("returns the list unchanged when moving the first item up", () => {
    expect(moveItem(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });

  it("returns the list unchanged when moving the last item down", () => {
    expect(moveItem(["a", "b"], 1, 1)).toEqual(["a", "b"]);
  });

  it("does not mutate the input list", () => {
    const list = ["a", "b"];
    moveItem(list, 0, 1);
    expect(list).toEqual(["a", "b"]);
  });
});

describe("normalizeLayout", () => {
  it("falls back to defaults for null", () => {
    expect(normalizeLayout(null).title).toBe(defaultLayout().title);
  });

  it("falls back to defaults for a non-object", () => {
    expect(normalizeLayout("garbage").sections).toHaveLength(4);
  });

  it("backfills missing array fields", () => {
    const out = normalizeLayout({ title: "KEEP ME" });
    expect(out.title).toBe("KEEP ME");
    expect(out.sections).toEqual([]);
    expect(out.avoid).toEqual([]);
    expect(out.reminders).toEqual([]);
  });

  it("defaults a section's visible flag to true when absent", () => {
    const out = normalizeLayout({ sections: [{ name: "X", meds: [] }] });
    expect(out.sections[0].visible).toBe(true);
  });

  it("coerces a non-array sections field to an empty array", () => {
    expect(normalizeLayout({ sections: "nope" }).sections).toEqual([]);
  });
});
