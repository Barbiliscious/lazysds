import { supabase } from "./supabase";
import type { NewSDSRecord } from "@shared/types";

/**
 * Confirms a reviewed record: uploads the PDF to the sds-pdfs bucket, then
 * inserts the row with the resulting public URL. Called only from the
 * review screen after a human has confirmed the fields.
 */
export async function saveReviewedRecord(
  file: File,
  record: Omit<NewSDSRecord, "pdf_url">,
): Promise<void> {
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

  const { error: insertError } = await supabase
    .from("sds_records")
    .insert({ ...record, pdf_url: urlData.publicUrl });
  if (insertError) {
    throw new Error(`Could not save the record: ${insertError.message}`);
  }
}
