import { describe, expect, it } from "vitest";
import type { ExtractedIndexRow, SDSField, SDSFieldKey, SDSIndexRecord } from "@shared/types";
import { buildBatchZip, type BatchItem } from "./download-batch";

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

describe("buildBatchZip", () => {
  it("zips one spreadsheet covering every record plus each record's source PDF", async () => {
    const items = [makeItem("ACME-BLEACH-2026-01-01", "bleach.pdf"), makeItem("ACME-DEGREASER-2026-01-02", "degreaser.pdf")];
    const zip = await loadZip(await buildBatchZip(items));

    expect(Object.keys(zip.files).sort()).toEqual([
      "ACME-BLEACH-2026-01-01.pdf",
      "ACME-DEGREASER-2026-01-02.pdf",
      "sds-register.xlsx",
    ]);
  });

  it("works for a single item (a batch of one)", async () => {
    const zip = await loadZip(await buildBatchZip([makeItem("ACME-BLEACH-2026-01-01", "bleach.pdf")]));
    expect(Object.keys(zip.files).sort()).toEqual(["ACME-BLEACH-2026-01-01.pdf", "sds-register.xlsx"]);
  });

  it("disambiguates two records that share a record_id", async () => {
    const items = [makeItem("ACME-BLEACH-2026-01-01", "a.pdf"), makeItem("ACME-BLEACH-2026-01-01", "b.pdf")];
    const zip = await loadZip(await buildBatchZip(items));
    const names = Object.keys(zip.files);
    expect(names).toHaveLength(3);
    expect(names.filter((n) => n.startsWith("ACME-BLEACH-2026-01-01"))).toHaveLength(2);
  });

  it("the spreadsheet has one row per record", async () => {
    const items = [makeItem("ACME-BLEACH-2026-01-01", "a.pdf"), makeItem("ACME-DEGREASER-2026-01-02", "b.pdf")];
    const zip = await loadZip(await buildBatchZip(items));
    const xlsxBuffer = await zip.file("sds-register.xlsx")!.async("arraybuffer");

    const { Workbook } = await import("exceljs");
    const workbook = new Workbook();
    await workbook.xlsx.load(xlsxBuffer);
    const sheet = workbook.getWorksheet("SDS Index");
    expect(sheet?.getCell(4, 1).value).toBe("ACME-BLEACH-2026-01-01");
    expect(sheet?.getCell(5, 1).value).toBe("ACME-DEGREASER-2026-01-02");
  });
});
