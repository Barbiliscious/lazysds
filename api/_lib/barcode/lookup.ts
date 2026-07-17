import {
  lookupOpenFactsBarcode,
  type BarcodeProduct,
} from "./open-facts.js";
import { lookupUpcDatabaseBarcode } from "./upc-database.js";

export type BarcodeLookup = (code: string) => Promise<BarcodeProduct | null>;

/**
 * Runs product databases in order and returns the first usable match.
 * Individual provider failures are treated like misses so the scan flow
 * always reaches its built-in web-search fallback.
 */
export async function firstBarcodeMatch(
  code: string,
  lookups: readonly BarcodeLookup[],
): Promise<BarcodeProduct | null> {
  for (const lookup of lookups) {
    try {
      const product = await lookup(code);
      if (product) return product;
    } catch {
      continue;
    }
  }
  return null;
}

/** Open Facts first, then the allowance-limited UPC Database fallback. */
export async function lookupBarcode(code: string): Promise<BarcodeProduct | null> {
  const lookups: BarcodeLookup[] = [lookupOpenFactsBarcode];
  const upcDatabaseKey = process.env.UPC_DATABASE_API_KEY?.trim();
  if (upcDatabaseKey) {
    lookups.push((barcode) => lookupUpcDatabaseBarcode(barcode, upcDatabaseKey));
  }
  return firstBarcodeMatch(code, lookups);
}
