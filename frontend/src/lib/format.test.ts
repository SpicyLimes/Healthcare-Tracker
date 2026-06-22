import { describe, it, expect } from "vitest";
import { feetInchesToIn, inToFeetInches, formatHeight } from "./format";

describe("feetInchesToIn", () => {
  it("converts 5 ft 4 in to 64", () => expect(feetInchesToIn(5, 4)).toBe(64));
  it("converts 5 ft 0 in to 60", () => expect(feetInchesToIn(5, 0)).toBe(60));
  it("returns null when both null", () => expect(feetInchesToIn(null, null)).toBeNull());
  it("returns inches-only when ft is null", () => expect(feetInchesToIn(null, 6)).toBe(6));
  it("returns feet-only when inches is null", () => expect(feetInchesToIn(5, null)).toBe(60));
});

describe("inToFeetInches", () => {
  it("converts 64 to 5ft 4in", () => expect(inToFeetInches(64)).toEqual({ ft: 5, inches: 4 }));
  it("converts 60 to 5ft 0in", () => expect(inToFeetInches(60)).toEqual({ ft: 5, inches: 0 }));
  it("returns nulls for null input", () => expect(inToFeetInches(null)).toEqual({ ft: null, inches: null }));
});

describe("formatHeight", () => {
  it('formats 64 as 5\'4"', () => expect(formatHeight(64)).toBe('5\'4"'));
  it('formats 60 as 5\'0"', () => expect(formatHeight(60)).toBe('5\'0"'));
  it("returns — for null", () => expect(formatHeight(null)).toBe("—"));
});
