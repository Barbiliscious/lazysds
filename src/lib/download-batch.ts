import type { SDSIndexRecord } from "@shared/types";
import { buildRegisterWorkbook, downloadBlob } from "./export-register";

/** One record just approved in this session, paired with its source PDF. */
export interface BatchItem {
  record: SDSIndexRecord;
  file: File;
}

function zipFilename(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `sds-batch-${today}.zip`;
}

// Exported for tests: build the zip without triggering a download.
export async function buildBatchZip(items: BatchItem[]): Promise<Blob> {
  const [{ default: JSZip }, workbook] = await Promise.all([
    import("jszip"),
    buildRegisterWorkbook(items.map((item) => item.record)),
  ]);

  const zip = new JSZip();
  const xlsxBuffer = await workbook.xlsx.writeBuffer();
  zip.file("sds-register.xlsx", xlsxBuffer);

  const usedNames = new Set<string>();
  for (const { record, file } of items) {
    let name = `${record.record_id}.pdf`;
    if (usedNames.has(name)) name = `${record.record_id}-${crypto.randomUUID().slice(0, 8)}.pdf`;
    usedNames.add(name);
    // Read as bytes rather than handing jszip the File/Blob directly - jszip's
    // Blob-reading path needs a browser FileReader, which Node (and so the
    // test suite) doesn't have.
    zip.file(name, await file.arrayBuffer());
  }

  return zip.generateAsync({ type: "blob" });
}

/**
 * Zips a spreadsheet covering every record just approved (one row each,
 * same styling as the full register export) together with each record's
 * source PDF, and triggers a download. Works the same for a batch of many
 * or a single upload (a "batch of one").
 */
export async function downloadBatchZip(items: BatchItem[]): Promise<void> {
  const blob = await buildBatchZip(items);
  downloadBlob(blob, zipFilename());
}
