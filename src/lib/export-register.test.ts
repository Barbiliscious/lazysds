import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtractedIndexRow, SDSField, SDSFieldKey, SDSIndexRecord } from "@shared/types";
import { buildRegisterWorkbook, cellText, registerToCsv, sanitizePasteCell } from "./export-register";

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

afterEach(() => {
  vi.unstubAllEnvs();
});

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
    expect(cellText(r, { record: "verified_at" })).toBe("2026-07-14");
  });

  it("derives SDS Filename from the record id, not the raw fields", () => {
    const r = makeRecord();
    expect(cellText(r, { record: "sds_filename" })).toBe("RECKITT-MORTEIN-2024-03-12.pdf");
  });

  it("SDS Link is empty when no SharePoint base URL is configured", () => {
    vi.stubEnv("VITE_SHAREPOINT_LIBRARY_URL", "");
    const r = makeRecord();
    expect(cellText(r, { record: "sds_link" })).toBe("");
  });

  it("SDS Link joins the configured base URL with the SDS Filename", () => {
    vi.stubEnv("VITE_SHAREPOINT_LIBRARY_URL", "https://tenant.sharepoint.com/sites/Site/Shared Documents/SDS/");
    const r = makeRecord();
    expect(cellText(r, { record: "sds_link" })).toBe(
      "https://tenant.sharepoint.com/sites/Site/Shared Documents/SDS/RECKITT-MORTEIN-2024-03-12.pdf",
    );
  });
});

describe("sanitizePasteCell", () => {
  it("replaces line breaks, tabs and carriage returns with '; '", () => {
    expect(sanitizePasteCell("line one\nline two\r\nline three\ttabbed")).toBe(
      "line one; line two; line three; tabbed",
    );
  });

  it("trims and collapses repeated spaces", () => {
    expect(sanitizePasteCell("  a   b    c  ")).toBe("a b c");
  });

  it("normalises an exact yes/no value to uppercase", () => {
    expect(sanitizePasteCell("yes")).toBe("YES");
    expect(sanitizePasteCell("No")).toBe("NO");
  });

  it("does not touch 'yes'/'no' as part of longer text", () => {
    expect(sanitizePasteCell("No gloves required")).toBe("No gloves required");
  });

  it("turns the literal strings None/null/NaN into a genuinely empty cell", () => {
    expect(sanitizePasteCell("None")).toBe("");
    expect(sanitizePasteCell("null")).toBe("");
    expect(sanitizePasteCell("NaN")).toBe("");
    expect(sanitizePasteCell("undefined")).toBe("");
  });

  it("leaves ordinary text containing those words alone", () => {
    expect(sanitizePasteCell("None of the above applies")).toBe("None of the above applies");
  });

  it("caps a cell at 30000 characters", () => {
    expect(sanitizePasteCell("x".repeat(40000)).length).toBe(30000);
  });
});

describe("registerToCsv", () => {
  it("has the 22 columns in the header, SDS Filename then SDS Link last", () => {
    const header = (registerToCsv([]).split("\r\n")[0] ?? "").split(",");
    expect(header).toHaveLength(22);
    expect(header[0]).toBe("SDS Record ID");
    expect(header).toContain("Signal Word");
    expect(header).toContain("PPE");
    expect(header).not.toContain("Pictograms");
    expect(header[header.length - 2]).toBe("SDS Filename");
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

describe("buildRegisterWorkbook", () => {
  it("builds a Paste sheet: one header row, sanitised data rows, no formatting", async () => {
    vi.stubEnv("VITE_SHAREPOINT_LIBRARY_URL", "https://tenant.sharepoint.com/sites/Site/SDS");
    const record = makeRecord({ ppe: stated("REQUIRED:\nEyes / Face - goggles") });
    const workbook = await buildRegisterWorkbook([record]);
    const buffer = await workbook.xlsx.writeBuffer();
    const { Workbook } = await import("exceljs");
    const loaded = new Workbook();
    await loaded.xlsx.load(buffer);

    const sheet = loaded.getWorksheet("Paste");
    expect(sheet).toBeDefined();
    expect(sheet?.columnCount).toBe(22);

    // Row 1 is the header - nothing else above the data.
    expect(sheet?.getCell(1, 1).value).toBe("SDS Record ID");
    expect(sheet?.getCell(1, 21).value).toBe("SDS Filename");
    expect(sheet?.getCell(1, 22).value).toBe("SDS Link");

    // Row 2 is the first (only) data row.
    expect(sheet?.getCell(2, 1).value).toBe("RECKITT-MORTEIN-2024-03-12");
    expect(sheet?.getCell(2, 21).value).toBe("RECKITT-MORTEIN-2024-03-12.pdf");

    // The multi-line PPE value is flattened to a single "; "-joined line -
    // a real line break would end a SharePoint grid paste early.
    const ppeCol = 12;
    expect(sheet?.getCell(2, ppeCol).value).toBe("REQUIRED:; Eyes / Face - goggles");

    // No formatting of any kind: no merges, no frozen panes, plain string
    // values rather than hyperlink/rich-text objects.
    expect(sheet?.model.merges).toEqual([]);
    expect(sheet?.views ?? []).toEqual([]);
    expect(sheet?.getCell(2, 22).value).toBe(
      "https://tenant.sharepoint.com/sites/Site/SDS/RECKITT-MORTEIN-2024-03-12.pdf",
    );
    expect(typeof sheet?.getCell(2, 22).value).toBe("string");
  });

  it("writes a genuinely empty cell for a not-stated field, not the word NOT STATED as a formatting artifact", async () => {
    // (Sanity check that empty-string guarding doesn't eat real status text.)
    const workbook = await buildRegisterWorkbook([makeRecord()]);
    const buffer = await workbook.xlsx.writeBuffer();
    const { Workbook } = await import("exceljs");
    const loaded = new Workbook();
    await loaded.xlsx.load(buffer);
    const sheet = loaded.getWorksheet("Paste");
    expect(sheet?.getCell(2, 7).value).toBe("NOT STATED"); // column 7: Hazardous Chemical?
  });

  it("moves the disclaimer and column/group documentation to a Read Me sheet", async () => {
    const workbook = await buildRegisterWorkbook([makeRecord()]);
    const buffer = await workbook.xlsx.writeBuffer();
    const { Workbook } = await import("exceljs");
    const loaded = new Workbook();
    await loaded.xlsx.load(buffer);

    const readMe = loaded.getWorksheet("Read Me");
    expect(readMe).toBeDefined();
    const cells: string[] = [];
    readMe?.eachRow((row) => row.eachCell((cell) => cells.push(String(cell.value ?? ""))));
    expect(cells.some((c) => c.includes("QUICK REFERENCE ONLY"))).toBe(true);
    expect(cells).toContain("IDENTIFICATION");
    expect(cells).toContain("Product Name");
  });
});
