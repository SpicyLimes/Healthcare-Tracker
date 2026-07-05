import { describe, expect, it } from "vitest";

import { dateToLocalInputValue } from "./datetime";

describe("dateToLocalInputValue", () => {
  it("renders local wall-clock components, not UTC", () => {
    // Local-component constructor: this is 20:30 local regardless of the
    // machine's timezone, so the expected string never shifts.
    const d = new Date(2026, 6, 15, 20, 30);
    expect(dateToLocalInputValue(d)).toBe("2026-07-15T20:30");
  });

  it("zero-pads month, day, hour and minute", () => {
    const d = new Date(2026, 0, 5, 9, 5);
    expect(dateToLocalInputValue(d)).toBe("2026-01-05T09:05");
  });
});
