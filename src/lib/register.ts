import { supabase } from "./supabase";
import { buildRecord } from "./build-record";
import type { ExtractedIndexRow, SDSIndexRecord } from "@shared/types";

/**
 * Reads and manages the register. RLS allows anon select/insert/update/delete
 * (see migration 0003 and the access-model note in CLAUDE.md): with no user
 * accounts, anyone with the URL can edit or delete entries.
 */

export async function fetchRegister(): Promise<SDSIndexRecord[]> {
  const { data, error } = await supabase
    .from("sds_index")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Could not load the register: ${error.message}`);
  }
  return (data ?? []) as SDSIndexRecord[];
}

export async function fetchRecordById(id: string): Promise<SDSIndexRecord | null> {
  const { data, error } = await supabase.from("sds_index").select("*").eq("id", id).maybeSingle();
  if (error) {
    throw new Error(`Could not load that entry: ${error.message}`);
  }
  return (data as SDSIndexRecord | null) ?? null;
}

/**
 * Saves edits to an existing entry. The date-derived columns (record id,
 * review date, currency) are recomputed in code the same way as at first
 * save, so a corrected Issue Date flows through everywhere. The PDF and its
 * URL are kept as-is - only the reviewed fields change.
 */
export async function updateRecord(
  record: SDSIndexRecord,
  extracted: ExtractedIndexRow,
  verifiedBy: string,
): Promise<void> {
  const rebuilt = buildRecord(extracted, record.pdf_url, record.source, verifiedBy);
  const { error } = await supabase.from("sds_index").update(rebuilt).eq("id", record.id);
  if (error) {
    throw new Error(`Could not save your changes: ${error.message}`);
  }
}

/** Removes an entry and its stored PDF. A failed PDF delete doesn't block the row delete. */
export async function deleteRecord(record: SDSIndexRecord): Promise<void> {
  const path = storagePathFromPublicUrl(record.pdf_url);
  if (path) {
    // Best effort - an orphaned PDF is harmless; a stuck row is not.
    await supabase.storage.from("sds-pdfs").remove([path]).catch(() => undefined);
  }
  const { error } = await supabase.from("sds_index").delete().eq("id", record.id);
  if (error) {
    throw new Error(`Could not delete that entry: ${error.message}`);
  }
}

/** Pulls the object path out of a public storage URL (…/sds-pdfs/<path>). */
function storagePathFromPublicUrl(publicUrl: string): string | null {
  const marker = "/sds-pdfs/";
  const at = publicUrl.indexOf(marker);
  if (at === -1) return null;
  try {
    return decodeURIComponent(publicUrl.slice(at + marker.length));
  } catch {
    return null;
  }
}
