import { supabase } from "./supabase";
import type { SDSIndexRecord } from "@shared/types";

/**
 * Loads the whole register, newest first. RLS only allows anon select on
 * this table, so this is read-only by construction.
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
