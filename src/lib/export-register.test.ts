import { describe, expect, it } from "vitest";
import type { ExtractedIndexRow, SDSField, SDSFieldKey, SDSIndexRecord } from "@shared/types";
import { cellText, registerToCsv } from "./export-register";

const FIELD_KEYS: SDSFieldKey[] = [
  "product_name", "manufacturer", "supplier_importer", "product_codes", "issue_date",
  "review_date_stated", "hazardous_chemical", "dangerous_goods", "signal_word", "pictograms",
  "hazard_statements", "poisons_schedule", "un_number", "dg_class", "packing_group",
  "ppe_eyes_face", "ppe_hands", "ppe_respiratory", "ppe_body", "first_aid", "spill",
  "storage", "incompatibilities", "fire_media", "dilution_condition",
];

const notStated: SDSField = { value: null, status: "NOT_STATED", excerpt: null, location: null };
const stated = (value: string): SDSField => ({ value, status: "STATED", excerpt: `src: ${value}`, location: "Section 1" });

function makeRecord(overrides: Partial<Record<SDSFieldKey, SDSField>> = {}, extra: Partial<SDSIndexRecord> = {}): SDSIndexRecord {
  const base = Object.fromEntries(FIELD_KEYS.map((k) => [k, notStated])) as Record<SDSFieldKey, SDSField>;
  const extracted: ExtractedIndexRow = {
    ...base,
    ...overrides,
    extraction_status: "READY_FOR_HUMAN_REVIEW",
    review_reasons: [],
  };
  return {
    id: "00000000-0000-0000-0000-000000000001",
    record_id: "RECKITT-MORTEIN-2024-03-12",
    pdf_url: "https://example.com/sds.pdf",
    extracted,
    review_date: "2029-03-12",
    review_date_calculated: true,
    currency_flag: "CURRENT",
    source: "upload",
    verified_by: "AM",
    verified_at: "2026-07-14T02:30:00.000Z",
    created_at: "2026-07-14T02:30:00.000Z",
    ...extra,
  };
}

describe("cellText", () => {
  it("renders a stated field's value and a not-stated field's status", () => {
    const r = makeRecord({ product_name: stated("Mortein Outdoor") });
    expect(cellText(r, { field: "product_name" })).toBe("Mortein Outdoor");
    expect(cellText(r, { field: "manufacturer" })).toBe("NOT STATED");
  });
  it("renders record-derived columns", () => {
    const r = makeRecord({}, { currency_flag: "POSSIBLY_OUTDATED" });
    expect(cellText(r, { record: "record_id" })).toBe("RECKITT-MORTEIN-2024-03-12");
    expect(cellText(r, { record: "sds_link" })).toBe("https://example.com/sds.pdf");
    expect(cellText(r, { record: "currency_flag" })).toBe("POSSIBLY OUTDATED - OBTAIN CURRENT SDS");
    expect(cellText(r, { record: "verified_at" })).toBe("2026-07-14");
  });
  it("renders the controlled N/A-unclear status verbatim", () => {
    const r = makeRecord({ poisons_schedule: { value: null, status: "NA_UNCLEAR", excerpt: null, location: null } });
    expect(cellText(r, { field: "poisons_schedule" })).toBe("N/A - MEANING UNCLEAR - MANUAL REVIEW REQUIRED");
  });
});

describe("registerToCsv", () => {
  it("has all 32 configured columns in the header", () => {
    const header = (registerToCsv([]).split("\r\n")[0] ?? "").split(",");
    expect(header).toHaveLength(32);
    expect(header[0]).toBe("SDS Record ID");
    expect(header).toContain("Dilution / Use Condition");
    expect(header[header.length - 1]).toBe("Verified Date");
  });
  it("quotes values containing commas, quotes or newlines", () => {
    const csv = registerToCsv([makeRecord({ product_name: stated('Cleaner, "Heavy Duty"') })]);
    expect(csv).toContain('"Cleaner, ""Heavy Duty"""');
  });
  it("produces one CRLF-terminated line per record plus the header", () => {
    const csv = registerToCsv([makeRecord(), makeRecord()]);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.trimEnd().split("\r\n")).toHaveLength(3);
  });
});
