import { supabase } from "./supabase";
import type { ExtractedIndexRow, SDSIndexRecord, SDSSourceKind } from "@shared/types";
import { buildRecord } from "./build-record";

/**
 * Confirms a reviewed record: uploads the PDF to the sds-pdfs bucket, then
 * inserts the row with the resulting public URL. Called only from the
 * approval screen after a human has confirmed the fields. Returns the
 * inserted row (id and created_at included) so the caller can, for example,
 * email a copy of exactly what was saved.
 */
export async function saveReviewedRecord(
  file: File,
  extracted: ExtractedIndexRow,
  source: SDSSourceKind,
  verifiedBy: string,
): Promise<SDSIndexRecord> {
  // Unique path so two products with the same filename never collide.
  const safeName = file.name.replace(/[^\w.-]+/g, "_");
  const path = `${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("sds-pdfs")
    .upload(path, file, { contentType: "application/pdf" });
  if (uploadError) {
    throw new Error(`Could not store the PDF: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage.from("sds-pdfs").getPublicUrl(path);

  const record = buildRecord(extracted, urlData.publicUrl, source, verifiedBy);

  const { data: inserted, error: insertError } = await supabase
    .from("sds_index")
    .insert(record)
    .select()
    .single();
  if (insertError) {
    throw new Error(`Could not save the record: ${insertError.message}`);
  }
  return inserted as SDSIndexRecord;
}
