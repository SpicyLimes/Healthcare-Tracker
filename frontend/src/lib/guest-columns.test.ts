import { describe, it, expect } from "vitest";
import {
  GUEST_COLUMNS,
  MAX_GUEST_COLUMNS,
  guestColumns,
  fieldLabel,
} from "./guest-columns";

describe("guest columns", () => {
  it("never exceeds the readable cap", () => {
    for (const [section, cols] of Object.entries(GUEST_COLUMNS)) {
      expect(cols.length, `section '${section}'`).toBeLessThanOrEqual(MAX_GUEST_COLUMNS);
    }
  });

  it("shows what a visit was ABOUT, not just when it happened", () => {
    // The regression: slice(0,4) gave visit_type/visit_date/visit_time/
    // doctor_other and hid reason + summary entirely.
    const cols = GUEST_COLUMNS.visit_logs;
    expect(cols).toContain("reason");
    expect(cols).toContain("summary");
  });

  it("shows the resolved doctor name, not the raw free-text twin", () => {
    expect(GUEST_COLUMNS.visit_logs).toContain("doctor");
    expect(GUEST_COLUMNS.visit_logs).not.toContain("doctor_other");
    expect(GUEST_COLUMNS.surgeries).toContain("surgeon");
    expect(GUEST_COLUMNS.surgeries).not.toContain("surgeon_other");
    expect(GUEST_COLUMNS.hospitalizations).toContain("attending_physician");
  });

  it("drops configured columns the payload does not actually have", () => {
    const row = { name: "Amoxicillin", dose: "500mg" };
    expect(guestColumns("medications", row)).toEqual(["name", "dose"]);
  });

  it("falls back to first-N for an unconfigured section", () => {
    const row = { id: "x", a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, thing_id: "y" };
    const cols = guestColumns("something_new", row);
    expect(cols).toHaveLength(MAX_GUEST_COLUMNS);
    expect(cols).not.toContain("id");
    expect(cols).not.toContain("thing_id");
  });

  it("returns nothing when there are no rows", () => {
    expect(guestColumns("medications", undefined)).toEqual([]);
  });
});

describe("field labels", () => {
  it("spells clinical abbreviations the way a chart does", () => {
    // CSS `capitalize` turned these into "Spo2", "Bp Systolic", "Rx Od".
    expect(fieldLabel("spo2")).toBe("SpO₂");
    expect(fieldLabel("bp_systolic")).toBe("BP Systolic");
    expect(fieldLabel("rx_od")).toBe("Rx (OD)");
    expect(fieldLabel("temperature_f")).toBe("Temp (°F)");
  });

  it("humanises unknown keys", () => {
    expect(fieldLabel("some_new_field")).toBe("Some New Field");
  });
});
