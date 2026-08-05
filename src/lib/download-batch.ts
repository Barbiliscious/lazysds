import type { SDSIndexRecord } from "@shared/types";
import { sdsFilename } from "@shared/sds-id";
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

// Characters SharePoint rejects in a file/folder name.
const FORBIDDEN_FILENAME_CHARS = /["#%&*:<>?/\\|{}]/;

/** Thrown by buildBatchZip when the batch fails validation - lists every
 * problem found, not just the first, so it can all be fixed in one pass. */
export class BatchValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Batch export failed validation:\n${problems.map((p) => `- ${p}`).join("\n")}`);
    this.name = "BatchValidationError";
  }
}

/** Fails loudly, listing every problem: an empty SDS Record ID, a row with
 * no PDF attached, or a filename containing a character SharePoint rejects.
 * (A PDF with no matching row can't occur under this data model - a
 * BatchItem always pairs a record with the file it was extracted from.) */
function validateBatch(items: BatchItem[]): string[] {
  const problems: string[] = [];
  items.forEach(({ record, file }, i) => {
    if (!record.record_id.trim()) {
      problems.push(`Row ${i + 1}: empty SDS Record ID.`);
      return;
    }
    if (!file) {
      problems.push(`${record.record_id}: no matching PDF in the batch.`);
      return;
    }
    const name = sdsFilename(record.record_id);
    if (FORBIDDEN_FILENAME_CHARS.test(name)) {
      problems.push(`${name}: contains a character SharePoint rejects.`);
    }
  });
  return problems;
}

interface ResolvedFilename {
  name: string;
  item: BatchItem;
}

/** Assigns each item its SDS Filename, appending a numeric suffix (and
 * logging a warning) if two records would otherwise produce the same name. */
function resolveFilenames(items: BatchItem[]): { resolved: ResolvedFilename[]; warnings: string[] } {
  const warnings: string[] = [];
  const seenCounts = new Map<string, number>();
  const resolved = items.map((item) => {
    const base = sdsFilename(item.record.record_id);
    const seen = seenCounts.get(base) ?? 0;
    seenCounts.set(base, seen + 1);
    if (seen === 0) return { name: base, item };
    const suffixed = `${base.slice(0, -".pdf".length)}-${seen + 1}.pdf`;
    const warning = `Two records both produced "${base}" - renamed the second to "${suffixed}".`;
    console.warn(warning);
    warnings.push(warning);
    return { name: suffixed, item };
  });
  return { resolved, warnings };
}

// Exported for tests: build the zip without triggering a download.
export async function buildBatchZip(items: BatchItem[]): Promise<Blob> {
  const problems = validateBatch(items);
  if (problems.length > 0) throw new BatchValidationError(problems);

  const { resolved, warnings } = resolveFilenames(items);

  const [{ default: JSZip }, workbook] = await Promise.all([
    import("jszip"),
    buildRegisterWorkbook(items.map((item) => item.record)),
  ]);

  const zip = new JSZip();
  const xlsxBuffer = await workbook.xlsx.writeBuffer();
  zip.file("sds-register.xlsx", xlsxBuffer);

  for (const { name, item } of resolved) {
    // Read as bytes rather than handing jszip the File/Blob directly -
    // jszip's Blob-reading path needs a browser FileReader, which Node (and
    // so the test suite) doesn't have.
    zip.file(`pdfs/${name}`, await item.file.arrayBuffer());
  }

  const summary = [
    `SDS batch export: ${items.length} row(s) exported, ${resolved.length} PDF(s) bundled.`,
    ...warnings.map((w) => `Warning: ${w}`),
  ].join("\n");
  console.info(summary);

  return zip.generateAsync({ type: "blob" });
}

/**
 * Zips a spreadsheet covering every record just approved (one row each,
 * paste-ready for a SharePoint list) together with each record's source PDF
 * under a pdfs/ folder, and triggers a download. Works the same for a batch
 * of many or a single upload (a "batch of one").
 */
export async function downloadBatchZip(items: BatchItem[]): Promise<void> {
  const blob = await buildBatchZip(items);
  downloadBlob(blob, zipFilename());
}
