import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtractedIndexRow, SDSField, SDSFieldKey, SDSIndexRecord } from "@shared/types";
import { BatchValidationError, buildBatchZip, type BatchItem } from "./download-batch";

const FIELD_KEYS: SDSFieldKey[] = [
  "product_name", "manufacturer_supplier_importer", "product_codes", "issue_date",
  "review_date_stated", "hazardous_chemical", "dangerous_goods", "signal_word", "hazard_classification",
  "hazard_statements", "ppe", "first_aid", "spill", "storage", "fire_media",
];

const notStated: SDSField = { value: null, status: "NOT_STATED", excerpt: null, location: null };

function makeRecord(recordId: string, filenameStem: string): SDSIndexRecord {
  const base = Object.fromEntries(FIELD_KEYS.map((k) => [k, notStated])) as Record<SDSFieldKey, SDSField>;
  const extracted: ExtractedIndexRow = {
    ...base,
    extraction_status: "READY_FOR_HUMAN_REVIEW",
    review_reasons: [],
  };
  return {
    id: "00000000-0000-0000-0000-000000000001",
    record_id: recordId,
    filename_stem: filenameStem,
    pdf_url: "https://example.com/sds.pdf",
    extracted,
    review_date: "2029-03-12",
    review_date_calculated: true,
    currency_flag: "CURRENT",
    source: "upload",
    verified_by: "AM",
    verified_at: "2026-07-14T02:30:00.000Z",
    created_at: "2026-07-14T02:30:00.000Z",
    is_superseded: false,
    supersedes_id: null,
  };
}

function makeItem(recordId: string, filenameStem: string, filename: string): BatchItem {
  return {
    record: makeRecord(recordId, filenameStem),
    file: new File(["%PDF-1.4 fake"], filename, { type: "application/pdf" }),
  };
}

async function loadZip(blob: Blob) {
  const { default: JSZip } = await import("jszip");
  return JSZip.loadAsync(await blob.arrayBuffer());
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildBatchZip", () => {
  it("zips one spreadsheet at the root plus every PDF under pdfs/, named {stem}-{number}.pdf", async () => {
    const items = [makeItem("SDS-001", "Bleach", "bleach.pdf"), makeItem("SDS-002", "Degreaser", "degreaser.pdf")];
    const zip = await loadZip(await buildBatchZip(items));

    expect(Object.keys(zip.files).sort()).toEqual([
      "pdfs/",
      "pdfs/Bleach-001.pdf",
      "pdfs/Degreaser-002.pdf",
      "sds-register.xlsx",
    ]);
  });

  it("works for a single item (a batch of one)", async () => {
    const zip = await loadZip(await buildBatchZip([makeItem("SDS-001", "Bleach", "bleach.pdf")]));
    expect(Object.keys(zip.files).sort()).toEqual(["pdfs/", "pdfs/Bleach-001.pdf", "sds-register.xlsx"]);
  });

  it("disambiguates two records that produce the same filename with a numeric suffix, and warns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const items = [makeItem("SDS-001", "Bleach", "a.pdf"), makeItem("SDS-001", "Bleach", "b.pdf")];
    const zip = await loadZip(await buildBatchZip(items));
    const names = Object.keys(zip.files).filter((n) => n.endsWith(".pdf"));

    expect(names.sort()).toEqual(["pdfs/Bleach-001-2.pdf", "pdfs/Bleach-001.pdf"]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("renamed the second");
  });

  it("the spreadsheet's Paste sheet has one header row then one row per record", async () => {
    const items = [makeItem("SDS-001", "Bleach", "a.pdf"), makeItem("SDS-002", "Degreaser", "b.pdf")];
    const zip = await loadZip(await buildBatchZip(items));
    const xlsxBuffer = await zip.file("sds-register.xlsx")!.async("arraybuffer");

    const { Workbook } = await import("exceljs");
    const workbook = new Workbook();
    await workbook.xlsx.load(xlsxBuffer);
    const sheet = workbook.getWorksheet("Paste");
    expect(sheet?.getCell(1, 1).value).toBe("SDS Record ID");
    expect(sheet?.getCell(2, 1).value).toBe("SDS-001");
    expect(sheet?.getCell(3, 1).value).toBe("SDS-002");
  });

  it("fails loudly and lists every problem when a row has an empty SDS Record ID", async () => {
    const items = [makeItem("", "Bleach", "a.pdf"), makeItem("SDS-002", "Degreaser", "b.pdf")];
    await expect(buildBatchZip(items)).rejects.toThrow(BatchValidationError);
    try {
      await buildBatchZip(items);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(BatchValidationError);
      expect((err as BatchValidationError).problems).toEqual(["Row 1: empty SDS Record ID."]);
    }
  });

  it("fails loudly when a row has an empty SDS Filename", async () => {
    const items = [makeItem("SDS-001", "", "a.pdf")];
    await expect(buildBatchZip(items)).rejects.toThrow(/empty SDS Filename/);
  });

  it("fails loudly when a filename would contain a character SharePoint rejects", async () => {
    const items = [makeItem("SDS-001", "Bad/Name?", "a.pdf")];
    await expect(buildBatchZip(items)).rejects.toThrow(BatchValidationError);
  });

  it("fails loudly when a row has no matching PDF", async () => {
    const items = [{ record: makeRecord("SDS-001", "Bleach"), file: undefined } as unknown as BatchItem];
    await expect(buildBatchZip(items)).rejects.toThrow(/no matching PDF/);
  });

  it("logs a run summary with rows exported and PDFs bundled", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const items = [makeItem("SDS-001", "Bleach", "a.pdf"), makeItem("SDS-002", "Degreaser", "b.pdf")];
    await buildBatchZip(items);
    expect(info).toHaveBeenCalledWith(expect.stringContaining("2 row(s) exported, 2 PDF(s) bundled"));
  });
});
