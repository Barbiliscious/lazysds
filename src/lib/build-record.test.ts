import { describe, expect, it } from "vitest";
import type { ExtractedIndexRow, SDSField, SDSFieldKey } from "@shared/types";
import { buildRecord } from "./build-record";

const FIELD_KEYS: SDSFieldKey[] = [
  "product_name", "manufacturer_supplier_importer", "product_codes", "issue_date",
  "review_date_stated", "hazardous_chemical", "dangerous_goods", "signal_word", "hazard_classification",
  "hazard_statements", "ppe", "first_aid", "spill", "storage", "fire_media",
];
const notStated: SDSField = { value: null, status: "NOT_STATED", excerpt: null, location: null };
const stated = (value: string): SDSField => ({ value, status: "STATED", excerpt: "x", location: "Section 1" });

function makeRow(overrides: Partial<Record<SDSFieldKey, SDSField>>): ExtractedIndexRow {
  const base = Object.fromEntries(FIELD_KEYS.map((k) => [k, notStated])) as Record<SDSFieldKey, SDSField>;
  return { ...base, ...overrides, extraction_status: "READY_FOR_HUMAN_REVIEW", review_reasons: [] };
}

describe("buildRecord", () => {
  const now = new Date("2026-07-15T00:00:00Z");

  it("derives record id, calculated review date, and currency from the SDS dates", () => {
    const row = makeRow({
      product_name: stated("Mortein Outdoor"),
      manufacturer_supplier_importer: stated("Bunnings"),
      issue_date: stated("2024-03-12"),
    });
    const rec = buildRecord(row, "https://x/sds.pdf", "upload", "AM", now);
    expect(rec.record_id).toBe("BUNNINGS-MORTEIN-OUTDOOR-2024-03-12");
    expect(rec.review_date).toBe("2029-03-12");
    expect(rec.review_date_calculated).toBe(true);
    expect(rec.currency_flag).toBe("CURRENT");
    expect(rec.verified_by).toBe("AM");
  });

  it("flags an old SDS as possibly outdated", () => {
    const rec = buildRecord(makeRow({ issue_date: stated("2018-01-01") }), "u", "upload", "AM", now);
    expect(rec.currency_flag).toBe("POSSIBLY_OUTDATED");
  });

  it("prefers a stated review date and marks it not calculated", () => {
    const row = makeRow({ issue_date: stated("2024-01-01"), review_date_stated: stated("2028-01-01") });
    const rec = buildRecord(row, "u", "upload", "AM", now);
    expect(rec.review_date).toBe("2028-01-01");
    expect(rec.review_date_calculated).toBe(false);
  });

  it("uses the first stated organisation for the record id", () => {
    const row = makeRow({ manufacturer_supplier_importer: stated("Reckitt"), product_name: stated("Glen 20"), issue_date: stated("2025") });
    expect(buildRecord(row, "u", "upload", "AM", now).record_id).toBe("RECKITT-GLEN-20-2025");
  });
});
