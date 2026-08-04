import { describe, expect, it } from "vitest";
import type { ExtractedIndexRow, SDSField, SDSFieldKey, SDSIndexRecord } from "@shared/types";
import { buildRegisterWorkbook, cellText, registerToCsv, toRichLines } from "./export-register";

const FIELD_KEYS: SDSFieldKey[] = [
  "product_name", "manufacturer_supplier_importer", "product_codes", "issue_date",
  "review_date_stated", "hazardous_chemical", "dangerous_goods", "signal_word", "hazard_classification",
  "hazard_statements", "ppe", "first_aid", "spill", "storage", "fire_media",
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

  it("normalises typography dashes in app-generated values", () => {
    const r = makeRecord({ hazard_statements: stated("H318 – Causes serious eye damage — keep protected") });
    expect(cellText(r, { field: "hazard_statements" })).toBe("H318 - Causes serious eye damage - keep protected");
  });

  it("renders the single manufacturer / supplier / importer field", () => {
    const r = makeRecord({ manufacturer_supplier_importer: stated("Reckitt") });
    expect(cellText(r, { field: "manufacturer_supplier_importer" })).toBe("Reckitt");
  });

  it("renders record-derived columns", () => {
    const r = makeRecord();
    expect(cellText(r, { record: "record_id" })).toBe("RECKITT-MORTEIN-2024-03-12");
    expect(cellText(r, { record: "sds_link" })).toBe("https://example.com/sds.pdf");
    expect(cellText(r, { record: "verified_at" })).toBe("2026-07-14");
  });
});

describe("registerToCsv", () => {
  it("has the 21 grouped columns in the header, SDS Link last", () => {
    const header = (registerToCsv([]).split("\r\n")[0] ?? "").split(",");
    expect(header).toHaveLength(21);
    expect(header[0]).toBe("SDS Record ID");
    expect(header).toContain("Signal Word");
    expect(header).toContain("PPE");
    expect(header).not.toContain("Pictograms");
    expect(header[header.length - 1]).toBe("SDS Link");
  });

  it("quotes cells containing commas, quotes or newlines (multi-line PPE)", () => {
    const csv = registerToCsv([makeRecord({ ppe: stated("REQUIRED:\nEyes / Face - goggles") })]);
    expect(csv).toContain('"REQUIRED:\nEyes / Face - goggles"');
  });

  it("produces one CRLF-terminated line per record plus the header", () => {
    const csv = registerToCsv([makeRecord(), makeRecord()]);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.trimEnd().split("\r\n")).toHaveLength(3);
  });
});

describe("toRichLines", () => {
  it("bolds group headers and line labels, leaves body text plain", () => {
    const parts = toRichLines("REQUIRED:\nEyes / Face - Splash goggles.\nplain trailing line");
    expect(parts.map((p) => [Boolean(p.font.bold), p.text])).toEqual([
      [true, "REQUIRED:\n"],
      [true, "Eyes / Face"],
      [false, " - Splash goggles.\n"],
      [false, "plain trailing line"],
    ]);
  });
});

describe("buildRegisterWorkbook", () => {
  it("writes and reads back the 21-column workbook layout", async () => {
    const workbook = await buildRegisterWorkbook([makeRecord()]);
    const buffer = await workbook.xlsx.writeBuffer();
    const { Workbook } = await import("exceljs");
    const loaded = new Workbook();
    await loaded.xlsx.load(buffer);

    const sheet = loaded.getWorksheet("SDS Index");
    expect(sheet).toBeDefined();
    expect(sheet?.columnCount).toBe(21);
    expect(sheet?.getCell(3, 5).value).toBe("Issue Date");
    expect(sheet?.getCell(3, 21).value).toBe("SDS Link");
    expect(sheet?.getCell(4, 21).value).toEqual({
      text: "https://example.com/sds.pdf",
      hyperlink: "https://example.com/sds.pdf",
    });
    expect(sheet?.views[0]).toMatchObject({ state: "frozen", xSplit: 2, ySplit: 3 });
  });
});
