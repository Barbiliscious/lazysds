import { supabase } from "./supabase";
import type { SDSRecord } from "@shared/types";

/**
 * Loads the whole register, newest first. RLS only allows anon select on
 * this table, so this is read-only by construction.
 */
export async function fetchRegister(): Promise<SDSRecord[]> {
  const { data, error } = await supabase
    .from("sds_records")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Could not load the register: ${error.message}`);
  }
  return (data ?? []) as SDSRecord[];
}
