import {
  lookupOpenFactsBarcode,
  type BarcodeProduct,
} from "./open-facts.js";
import { lookupUpcDatabaseBarcode } from "./upc-database.js";
import { lookupEandataBarcode } from "./eandata.js";
import { fetchSavedMapping } from "./mapping.js";
import { lookupBarcodeViaWebSearch } from "./web-search.js";
import type { ScannedProduct } from "../../../shared/types.js";

export type BarcodeLookup = (code: string) => Promise<BarcodeProduct | null>;

/**
 * Runs product databases in order and returns the first usable match.
 * Individual provider failures are treated like misses so the scan flow
 * always reaches its fallbacks.
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

export interface LabelledLookup {
  id: string;
  run: BarcodeLookup;
}

/** Like firstBarcodeMatch, but keeps track of which provider actually hit. */
export async function firstLabelledMatch(
  code: string,
  lookups: readonly LabelledLookup[],
): Promise<{ product: BarcodeProduct; providerId: string } | null> {
  for (const { id, run } of lookups) {
    try {
      const product = await run(code);
      if (product) return { product, providerId: id };
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Full barcode resolution chain, cheapest and most-trusted first:
 *  1. Our own saved mapping (instant, a human already confirmed it).
 *  2. Free, keyless Open*Facts.
 *  3. The allowance-limited keyed providers (UPC Database, then eandata),
 *     only when configured - their scarce daily credits are spent only on
 *     barcodes the free sources miss.
 *  4. An AI web-search fallback that reads real search results and extracts
 *     structured product fields - the most expensive step, tried last.
 * Every hit is normalised to a ScannedProduct so /scan can show one
 * consistent shape regardless of source, tagged with sourceProvider so the
 * UI/mapping-save can record where it came from.
 */
export async function lookupBarcode(code: string): Promise<ScannedProduct | null> {
  const saved = await fetchSavedMapping(code);
  if (saved) return saved;

  const providers: LabelledLookup[] = [{ id: "open_facts", run: lookupOpenFactsBarcode }];

  const upcDatabaseKey = process.env.UPC_DATABASE_API_KEY?.trim();
  if (upcDatabaseKey) {
    providers.push({ id: "upc_database", run: (barcode) => lookupUpcDatabaseBarcode(barcode, upcDatabaseKey) });
  }

  const eandataKey = process.env.EANDATA_API_KEY?.trim();
  if (eandataKey) {
    providers.push({ id: "eandata", run: (barcode) => lookupEandataBarcode(barcode, eandataKey) });
  }

  const hit = await firstLabelledMatch(code, providers);
  if (hit) {
    return {
      barcode: code,
      name: hit.product.name,
      brand: hit.product.brand,
      manufacturerProductCode: null,
      size: null,
      variant: null,
      sourceUrl: null,
      sourceProvider: hit.providerId,
      confidence: "high", // an exact barcode-key match in a structured database
    };
  }

  return lookupBarcodeViaWebSearch(code);
}
