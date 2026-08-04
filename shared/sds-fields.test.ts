import { describe, expect, it } from "vitest";
import { FIELD_SPECS, normaliseExtracted } from "./sds-fields";
import type { ExtractedIndexRow, SDSField, SDSFieldKey } from "./types";

const stated = (value: string): SDSField => ({ value, status: "STATED", excerpt: "x", location: "Section 1" });

describe("normaliseExtracted", () => {
  it("fills in a field missing from an older stored record instead of leaving it undefined", () => {
    // Simulates a row saved before "hazard_classification" existed in
    // FIELD_SPECS - the stored JSON simply doesn't have that key.
    const legacyRow = Object.fromEntries(
      FIELD_SPECS.filter((s) => s.key !== "hazard_classification").map((s) => [s.key, stated("x")]),
    ) as Partial<ExtractedIndexRow>;
    const result = normaliseExtracted({
      ...legacyRow,
      extraction_status: "READY_FOR_HUMAN_REVIEW",
      review_reasons: [],
    });
    expect(result.hazard_classification).toEqual({ value: null, status: "NOT_STATED", excerpt: null, location: null });
  });

  it("keeps every existing field's value untouched", () => {
    const result = normaliseExtracted({
      product_name: stated("Mortein Outdoor"),
      extraction_status: "READY_FOR_HUMAN_REVIEW",
      review_reasons: [],
    });
    expect(result.product_name).toEqual(stated("Mortein Outdoor"));
  });

  it("covers every current field key exactly once", () => {
    const result = normaliseExtracted({});
    const keys = Object.keys(result).filter((k): k is SDSFieldKey =>
      FIELD_SPECS.some((s) => s.key === k),
    );
    expect(keys.sort()).toEqual(FIELD_SPECS.map((s) => s.key).sort());
  });

  it("defaults a missing verdict to MANUAL_REVIEW_REQUIRED rather than a silent READY", () => {
    const result = normaliseExtracted({});
    expect(result.extraction_status).toBe("MANUAL_REVIEW_REQUIRED");
    expect(result.review_reasons).toEqual([]);
  });
});
