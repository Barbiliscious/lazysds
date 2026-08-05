import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtractedIndexRow, SDSField, SDSFieldKey, SDSIndexRecord } from "@shared/types";
import { BatchValidationError, buildBatchZip, type BatchItem } from "./download-batch";

const FIELD_KEYS: SDSFieldKey[] = [
  "product_name", "manufacturer_supplier_importer", "product_codes", "issue_date",
  "review_date_stated", "hazardous_chemical", "dangerous_goods", "signal_word", "hazard_classification",
  "hazard_statements", "ppe", "first_aid", "spill", "storage", "fire_media",
];

const notStated: SDSField = { value: null, status: "NOT_STATED", excerpt: null, location: null };

function makeRecord(recordId: string): SDSIndexRecord {
  const base = Object.fromEntries(FIELD_KEYS.map((k) => [k, notStated])) as Record<SDSFieldKey, SDSField>;
  const extracted: ExtractedIndexRow = {
    ...base,
    extraction_status: "READY_FOR_HUMAN_REVIEW",
    review_reasons: [],
  };
  return {
    id: "00000000-0000-0000-0000-000000000001",
    record_id: recordId,
    pdf_url: "https://example.com/sds.pdf",
    extracted,
    review_date: "2029-03-12",
    review_date_calculated: true,
    currency_flag: "CURRENT",
    source: "upload",
    verified_by: "AM",
    verified_at: "2026-07-14T02:30:00.000Z",
    created_at: "2026-07-14T02:30:00.000Z",
  };
}

function makeItem(recordId: string, filename: string): BatchItem {
  return { record: makeRecord(recordId), file: new File(["%PDF-1.4 fake"], filename, { type: "application/pdf" }) };
}

async function loadZip(blob: Blob) {
  const { default: JSZip } = await import("jszip");
  return JSZip.loadAsync(await blob.arrayBuffer());
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildBatchZip", () => {
  it("zips one spreadsheet at the root plus every PDF under pdfs/", async () => {
    const items = [makeItem("ACME-BLEACH-2026-01-01", "bleach.pdf"), makeItem("ACME-DEGREASER-2026-01-02", "degreaser.pdf")];
    const zip = await loadZip(await buildBatchZip(items));

    expect(Object.keys(zip.files).sort()).toEqual([
      "pdfs/",
      "pdfs/ACME-BLEACH-2026-01-01.pdf",
      "pdfs/ACME-DEGREASER-2026-01-02.pdf",
      "sds-register.xlsx",
    ]);
  });

  it("works for a single item (a batch of one)", async () => {
    const zip = await loadZip(await buildBatchZip([makeItem("ACME-BLEACH-2026-01-01", "bleach.pdf")]));
    expect(Object.keys(zip.files).sort()).toEqual(["pdfs/", "pdfs/ACME-BLEACH-2026-01-01.pdf", "sds-register.xlsx"]);
  });

  it("disambiguates two records that share a record_id with a numeric suffix, and warns", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const items = [makeItem("ACME-BLEACH-2026-01-01", "a.pdf"), makeItem("ACME-BLEACH-2026-01-01", "b.pdf")];
    const zip = await loadZip(await buildBatchZip(items));
    const names = Object.keys(zip.files).filter((n) => n.endsWith(".pdf"));

    expect(names.sort()).toEqual(["pdfs/ACME-BLEACH-2026-01-01-2.pdf", "pdfs/ACME-BLEACH-2026-01-01.pdf"]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain("renamed the second");
  });

  it("the spreadsheet's Paste sheet has one header row then one row per record", async () => {
    const items = [makeItem("ACME-BLEACH-2026-01-01", "a.pdf"), makeItem("ACME-DEGREASER-2026-01-02", "b.pdf")];
    const zip = await loadZip(await buildBatchZip(items));
    const xlsxBuffer = await zip.file("sds-register.xlsx")!.async("arraybuffer");

    const { Workbook } = await import("exceljs");
    const workbook = new Workbook();
    await workbook.xlsx.load(xlsxBuffer);
    const sheet = workbook.getWorksheet("Paste");
    expect(sheet?.getCell(1, 1).value).toBe("SDS Record ID");
    expect(sheet?.getCell(2, 1).value).toBe("ACME-BLEACH-2026-01-01");
    expect(sheet?.getCell(3, 1).value).toBe("ACME-DEGREASER-2026-01-02");
  });

  it("fails loudly and lists every problem when a row has an empty SDS Record ID", async () => {
    const items = [makeItem("", "a.pdf"), makeItem("ACME-DEGREASER-2026-01-02", "b.pdf")];
    await expect(buildBatchZip(items)).rejects.toThrow(BatchValidationError);
    try {
      await buildBatchZip(items);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(BatchValidationError);
      expect((err as BatchValidationError).problems).toEqual(["Row 1: empty SDS Record ID."]);
    }
  });

  it("fails loudly when a filename would contain a character SharePoint rejects", async () => {
    const items = [makeItem("BAD/NAME?ID", "a.pdf")];
    await expect(buildBatchZip(items)).rejects.toThrow(BatchValidationError);
  });

  it("fails loudly when a row has no matching PDF", async () => {
    const items = [{ record: makeRecord("ACME-BLEACH-2026-01-01"), file: undefined } as unknown as BatchItem];
    await expect(buildBatchZip(items)).rejects.toThrow(/no matching PDF/);
  });

  it("logs a run summary with rows exported and PDFs bundled", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const items = [makeItem("ACME-BLEACH-2026-01-01", "a.pdf"), makeItem("ACME-DEGREASER-2026-01-02", "b.pdf")];
    await buildBatchZip(items);
    expect(info).toHaveBeenCalledWith(expect.stringContaining("2 row(s) exported, 2 PDF(s) bundled"));
  });
});
