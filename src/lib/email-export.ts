import type { SDSIndexRecord } from "@shared/types";
import { isValidEmail } from "@shared/email";
import { sdsFilename } from "@shared/sds-id";
import { supabase } from "./supabase";
import { buildBatchZip, type BatchItem } from "./download-batch";
import { sendRegisterExportEmail } from "./api-client";

/**
 * Re-downloads a saved record's PDF from storage - the browser only holds
 * the File object for whichever record it's actively reviewing, not for
 * records already sitting in the register.
 */
async function fetchPdfFile(record: SDSIndexRecord): Promise<File> {
  const res = await fetch(record.pdf_url);
  if (!res.ok) {
    throw new Error(`Could not download the safety data sheet for ${record.record_id} (HTTP ${res.status}).`);
  }
  const blob = await res.blob();
  return new File([blob], `${sdsFilename(record.filename_stem, record.record_id)}.pdf`, { type: "application/pdf" });
}

/**
 * A human-readable storage path for the zip, so the filename a recipient
 * sees when they follow the emailed link (derived from the storage object's
 * name) is meaningful rather than a bare UUID - while still unique enough
 * to never collide with a previous export.
 */
function exportZipPath(recordCount: number): string {
  const date = new Date().toISOString().slice(0, 10);
  const noun = recordCount === 1 ? "record" : "records";
  const shortId = crypto.randomUUID().slice(0, 8);
  return `exports/sds-export-${date}-${recordCount}${noun}-${shortId}.zip`;
}

/**
 * Zips the given records (spreadsheet + PDFs, same shape as the batch
 * download), uploads the zip to storage, and emails a download link to the
 * given address. This is a direct user action, not a best-effort background
 * one - callers should surface a thrown error rather than swallow it.
 */
export async function emailSelectedRecords(records: SDSIndexRecord[], to: string): Promise<void> {
  if (records.length === 0) {
    throw new Error("Select at least one record first.");
  }
  const address = to.trim();
  if (!isValidEmail(address)) {
    throw new Error("That doesn't look like a valid email address.");
  }

  const files = await Promise.all(records.map(fetchPdfFile));
  const items: BatchItem[] = records.map((record, i) => ({ record, file: files[i]! }));
  const zipBlob = await buildBatchZip(items);

  const path = exportZipPath(records.length);
  const { error: uploadError } = await supabase.storage
    .from("sds-pdfs")
    .upload(path, zipBlob, { contentType: "application/zip" });
  if (uploadError) {
    throw new Error(`Could not prepare the export: ${uploadError.message}`);
  }
  const { data: urlData } = supabase.storage.from("sds-pdfs").getPublicUrl(path);

  const result = await sendRegisterExportEmail({
    to: address,
    url: urlData.publicUrl,
    recordCount: records.length,
  });
  if (result.skipped) {
    throw new Error("Emailing isn't set up for this app yet.");
  }
}
