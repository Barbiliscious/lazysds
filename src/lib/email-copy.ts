import type { SDSIndexRecord } from "@shared/types";
import { buildRegisterWorkbook } from "./export-register";
import { sendRegisterCopyEmail } from "./api-client";

/** Reads a File/Blob into a base64 string (no "data:" prefix). */
async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000; // avoid a call-stack blowup from spreading a large typed array
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Best-effort: emails a one-row copy of the spreadsheet plus the source PDF
 * for a just-saved record. Callers should treat a rejection here as
 * non-fatal - the record is already saved to the register regardless of
 * whether the email goes out.
 */
export async function emailRegisterCopy(
  record: SDSIndexRecord,
  pdfFile: File,
): Promise<{ ok: boolean; skipped?: boolean }> {
  const workbook = await buildRegisterWorkbook([record]);
  const xlsxBuffer = await workbook.xlsx.writeBuffer();
  const [xlsxBase64, pdfBase64] = await Promise.all([
    toBase64(new Blob([xlsxBuffer])),
    toBase64(pdfFile),
  ]);

  const productName = record.extracted.product_name.value ?? record.record_id;
  return sendRegisterCopyEmail({
    productName,
    xlsxBase64,
    xlsxFilename: `${record.record_id}.xlsx`,
    pdfBase64,
    pdfFilename: pdfFile.name,
  });
}
