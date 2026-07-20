import { getServerSupabaseClient } from "../supabase.js";
import type { ScannedProduct } from "../../../shared/types.js";

/**
 * The internal barcode -> product mapping table (migration 0004). Checked
 * before any external provider, so once a worker confirms a barcode it's
 * answered instantly on every later scan without calling anything else.
 */

interface MappingRow {
  barcode: string;
  product_name: string;
  brand: string | null;
  manufacturer_product_code: string | null;
  size: string | null;
  variant: string | null;
  source_url: string | null;
}

/** A saved mapping is always "high" confidence - a human already confirmed it. */
export async function fetchSavedMapping(barcode: string): Promise<ScannedProduct | null> {
  const { data, error } = await getServerSupabaseClient()
    .from("barcode_mappings")
    .select("barcode, product_name, brand, manufacturer_product_code, size, variant, source_url")
    .eq("barcode", barcode)
    .maybeSingle();

  // A lookup failure here shouldn't sink the scan - just fall through to the
  // provider chain as if there were no saved mapping.
  if (error || !data) return null;

  const row = data as MappingRow;
  return {
    barcode: row.barcode,
    name: row.product_name,
    brand: row.brand,
    manufacturerProductCode: row.manufacturer_product_code,
    size: row.size,
    variant: row.variant,
    sourceUrl: row.source_url,
    sourceProvider: "saved_mapping",
    confidence: "high",
  };
}

/**
 * Saves a worker-confirmed product as the mapping for its barcode, updating
 * it in place if one already exists (a worker correcting a bad mapping).
 * Update-then-insert rather than .upsert(): without generated DB types,
 * supabase-js's upsert() typing collapses to `never` here, while insert/update
 * (used everywhere else in this codebase) type-check fine as plain objects.
 * Two round trips instead of one is a non-issue for a human-paced confirm tap.
 */
export async function saveMapping(product: ScannedProduct, verifiedBy: string | null): Promise<void> {
  const client = getServerSupabaseClient();
  const fields = {
    product_name: product.name,
    brand: product.brand,
    manufacturer_product_code: product.manufacturerProductCode,
    size: product.size,
    variant: product.variant,
    source_url: product.sourceUrl,
    source_provider: product.sourceProvider,
    verified_by: verifiedBy,
    verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: updated, error: updateError } = await client
    .from("barcode_mappings")
    .update(fields)
    .eq("barcode", product.barcode)
    .select("barcode");
  if (updateError) {
    throw new Error(`Could not save the barcode mapping: ${updateError.message}`);
  }
  if (updated && updated.length > 0) return; // an existing mapping was corrected

  const { error: insertError } = await client.from("barcode_mappings").insert({ barcode: product.barcode, ...fields });
  if (insertError) {
    throw new Error(`Could not save the barcode mapping: ${insertError.message}`);
  }
}
