import { describe, expect, it } from "vitest";
import {
  addFiveYears,
  computeCurrencyFlag,
  formatSdsDate,
  parseSdsDate,
  resolveReviewDate,
} from "./sds-dates";

describe("parseSdsDate / formatSdsDate", () => {
  it("round-trips the three precisions", () => {
    for (const s of ["2020", "2020-11", "2020-11-15"]) {
      expect(formatSdsDate(parseSdsDate(s)!)).toBe(s);
    }
  });
  it("rejects malformed and out-of-range dates", () => {
    for (const s of ["", "Nov 2020", "2020-13", "2020-11-32", "20-11-15"]) {
      expect(parseSdsDate(s)).toBeNull();
    }
  });
});

describe("addFiveYears", () => {
  it("preserves precision and never invents a day", () => {
    expect(addFiveYears("2020-11")).toBe("2025-11");
    expect(addFiveYears("2020")).toBe("2025");
    expect(addFiveYears("2020-11-15")).toBe("2025-11-15");
  });
});

describe("resolveReviewDate", () => {
  it("prefers the stated date over the calculation", () => {
    expect(resolveReviewDate("2020-01-01", "2026-06-01")).toEqual({ date: "2026-06-01", calculated: false });
  });
  it("calculates Issue + 5 years when no review date is stated", () => {
    expect(resolveReviewDate("2020-11", null)).toEqual({ date: "2025-11", calculated: true });
  });
  it("returns nothing when there is no issue date and no stated review date", () => {
    expect(resolveReviewDate(null, null)).toEqual({ date: null, calculated: false });
  });
});

describe("computeCurrencyFlag", () => {
  const today = new Date("2026-07-15T00:00:00Z");
  it("flags a review date that has passed", () => {
    expect(computeCurrencyFlag("2019-01-01", "2024-01-01", today)).toBe("POSSIBLY_OUTDATED");
  });
  it("flags an issue date more than five years old", () => {
    expect(computeCurrencyFlag("2020-01-01", "2025-01-01", today)).toBe("POSSIBLY_OUTDATED");
  });
  it("is current when the issue is recent and review is in the future", () => {
    expect(computeCurrencyFlag("2024-06-01", "2029-06-01", today)).toBe("CURRENT");
  });
  it("is unconfirmed when no date is known", () => {
    expect(computeCurrencyFlag(null, null, today)).toBe("DATE_UNCONFIRMED");
  });
});
