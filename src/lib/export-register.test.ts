import { describe, expect, it } from "vitest";
import type { ExtractedIndexRow, SDSField, SDSFieldKey, SDSIndexRecord } from "@shared/types";
import { buildRegisterWorkbook, cellText, registerToCsv } from "./export-register";

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
    expect(cellText(r, { field: "hazardous_chemical" })).toBe("NOT STATED");
  });

  it("uses controlled pictogram wording and normal hyphens in exported values", () => {
    const r = makeRecord({
      pictograms: stated("Flammable; Corrosive"),
      hazard_statements: stated("H318 – Causes serious eye damage — keep protected"),
    });
    expect(cellText(r, { field: "pictograms" })).toBe("Flammable; Corrosive");
    expect(cellText(makeRecord(), { field: "pictograms" })).toBe("Not stated");
    expect(cellText(r, { field: "hazard_statements" })).toBe("H318 - Causes serious eye damage - keep protected");
  });

  it("combines manufacturer and supplier, de-duplicating when identical", () => {
    const r1 = makeRecord({ manufacturer: stated("Reckitt"), supplier_importer: stated("Bunnings") });
    expect(cellText(r1, { combined: "manufacturer_supplier" })).toBe("Reckitt / Bunnings");
    const r2 = makeRecord({ manufacturer: stated("Reckitt"), supplier_importer: stated("Reckitt") });
    expect(cellText(r2, { combined: "manufacturer_supplier" })).toBe("Reckitt");
  });

  it("combines the present PPE sub-fields, skipping not-stated ones", () => {
    const r = makeRecord({
      ppe_eyes_face: stated("REQUIRED: Splash goggles."),
      ppe_hands: stated("REQUIRED: Nitrile gloves."),
    });
    expect(cellText(r, { combined: "ppe" })).toBe("Eyes / Face - REQUIRED: Splash goggles.\nHands - REQUIRED: Nitrile gloves.");
    expect(cellText(makeRecord(), { combined: "ppe" })).toBe("NOT STATED");
  });

  it("renders record-derived columns", () => {
    const r = makeRecord();
    expect(cellText(r, { record: "record_id" })).toBe("RECKITT-MORTEIN-2024-03-12");
    expect(cellText(r, { record: "sds_link" })).toBe("https://example.com/sds.pdf");
    expect(cellText(r, { record: "verified_at" })).toBe("2026-07-14");
  });
});

describe("registerToCsv", () => {
  it("has the 20 grouped columns in the header, SDS Link last", () => {
    const header = (registerToCsv([]).split("\r\n")[0] ?? "").split(",");
    expect(header).toHaveLength(20);
    expect(header[0]).toBe("SDS Record ID");
    expect(header).toContain("Manufacturer / Supplier / Importer");
    expect(header).toContain("Issue Date");
    expect(header).not.toContain("Issue / Revision Date");
    expect(header[header.length - 1]).toBe("SDS Link");
  });

  it("quotes cells containing commas, quotes or newlines (combined PPE)", () => {
    const csv = registerToCsv([
      makeRecord({ ppe_eyes_face: stated("REQUIRED: goggles"), ppe_hands: stated("REQUIRED: gloves") }),
    ]);
    expect(csv).toContain('"Eyes / Face - REQUIRED: goggles\nHands - REQUIRED: gloves"');
  });

  it("produces one CRLF-terminated line per record plus the header", () => {
    const csv = registerToCsv([makeRecord(), makeRecord()]);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.trimEnd().split("\r\n")).toHaveLength(3);
  });
});

describe("buildRegisterWorkbook", () => {
  it("writes and reads back the exact 20-column workbook layout", async () => {
    const workbook = await buildRegisterWorkbook([makeRecord()]);
    const buffer = await workbook.xlsx.writeBuffer();
    const { Workbook } = await import("exceljs");
    const loaded = new Workbook();
    await loaded.xlsx.load(buffer);

    const sheet = loaded.getWorksheet("SDS Index");
    expect(sheet).toBeDefined();
    expect(sheet?.columnCount).toBe(20);
    expect(sheet?.getCell(3, 5).value).toBe("Issue Date");
    expect(sheet?.getCell(3, 20).value).toBe("SDS Link");
    expect(sheet?.getCell(4, 20).value).toEqual({
      text: "https://example.com/sds.pdf",
      hyperlink: "https://example.com/sds.pdf",
    });
    expect(sheet?.views[0]).toMatchObject({ state: "frozen", xSplit: 2, ySplit: 3 });
  });
});
