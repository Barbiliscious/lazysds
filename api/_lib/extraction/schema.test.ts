import { describe, expect, it } from "vitest";
import { extractedSDSSchema } from "./schema.js";
import type { ExtractedIndexRow, SDSField, SDSFieldKey } from "../../../shared/types.js";

const FIELD_KEYS: SDSFieldKey[] = [
  "product_name", "manufacturer", "supplier_importer", "product_codes", "issue_date",
  "review_date_stated", "hazardous_chemical", "dangerous_goods", "signal_word", "pictograms",
  "hazard_statements", "poisons_schedule", "un_number", "dg_class", "packing_group",
  "ppe_eyes_face", "ppe_hands", "ppe_respiratory", "ppe_body", "first_aid", "spill",
  "storage", "incompatibilities", "fire_media", "dilution_condition",
];

const notStated: SDSField = { value: null, status: "NOT_STATED", excerpt: null, location: null };

function makeRow(overrides: Partial<Record<SDSFieldKey, SDSField>> = {}): ExtractedIndexRow {
  const base = Object.fromEntries(FIELD_KEYS.map((k) => [k, notStated])) as Record<SDSFieldKey, SDSField>;
  return {
    ...base,
    ...overrides,
    extraction_status: "READY_FOR_HUMAN_REVIEW",
    review_reasons: [],
  };
}

describe("extractedSDSSchema", () => {
  it("accepts a stated field with its evidence", () => {
    const row = makeRow({
      product_name: { value: "Mortein Outdoor", status: "STATED", excerpt: "Product name: Mortein Outdoor", location: "Section 1, SDS page 1" },
      hazardous_chemical: { value: "YES", status: "STATED", excerpt: "Classified as hazardous.", location: "Section 2, SDS page 1" },
    });
    const result = extractedSDSSchema.safeParse(row);
    expect(result.success).toBe(true);
  });

  it("accepts an all-not-stated row (every field a status, empty reasons)", () => {
    expect(extractedSDSSchema.safeParse(makeRow()).success).toBe(true);
  });

  it("rejects an out-of-vocabulary status", () => {
    const bad = makeRow();
    // @ts-expect-error deliberately invalid status token
    bad.product_name = { value: null, status: "MAYBE", excerpt: null, location: null };
    const result = extractedSDSSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-vocabulary extraction status", () => {
    const bad = { ...makeRow(), extraction_status: "APPROVED" };
    expect(extractedSDSSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a wrong shape (value must be string or null, not boolean)", () => {
    const bad = makeRow();
    // @ts-expect-error deliberately wrong value type
    bad.hazardous_chemical = { value: true, status: "STATED", excerpt: "x", location: "y" };
    expect(extractedSDSSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a payload missing fields", () => {
    expect(extractedSDSSchema.safeParse({ product_name: notStated }).success).toBe(false);
  });
});
