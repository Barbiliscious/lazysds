/**
 * Barcode -> product-name adapter backed by the Open Food Facts family -
 * free, keyless, open-licence databases. Coverage of Australian workplace
 * chemicals is patchy (it's crowdsourced), so callers must treat null as a
 * normal answer, not an error. The orchestrator in lookup.ts falls back to
 * UPC Database when these free sources do not know the barcode.
 */

export interface BarcodeProduct {
  name: string;
  brand: string | null;
}

// Household chemicals mostly live in Open Products Facts, but plenty of
// supermarket items only exist in the food/beauty siblings - same API.
const OPEN_FACTS_HOSTS = [
  "world.openproductsfacts.org",
  "world.openfoodfacts.org",
  "world.openbeautyfacts.org",
];

/** Pulls name/brand out of an Open*Facts v2 response; null if absent. */
export function parseOpenFactsResponse(json: unknown): BarcodeProduct | null {
  if (typeof json !== "object" || json === null) return null;
  const body = json as { status?: unknown; product?: { product_name?: unknown; brands?: unknown } };
  if (body.status !== 1 || typeof body.product !== "object" || body.product === null) return null;
  const name = typeof body.product.product_name === "string" ? body.product.product_name.trim() : "";
  if (name === "") return null;
  // "brands" is comma-separated ("Glen 20,Reckitt") - keep the first one.
  const brands = typeof body.product.brands === "string" ? body.product.brands : "";
  const brand = brands.split(",")[0]?.trim() ?? "";
  return { name, brand: brand === "" ? null : brand };
}

export async function lookupOpenFactsBarcode(code: string): Promise<BarcodeProduct | null> {
  for (const host of OPEN_FACTS_HOSTS) {
    try {
      const res = await fetch(
        `https://${host}/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands`,
        {
          signal: AbortSignal.timeout(6_000),
          // Open Food Facts asks API users to identify themselves.
          headers: { "User-Agent": "LazySDS/1.0 (https://lazysds.vercel.app)" },
        },
      );
      // 404 = "barcode not in this database" - try the next sibling.
      if (!res.ok) continue;
      const product = parseOpenFactsResponse(await res.json());
      if (product) return product;
    } catch {
      continue; // one database being down shouldn't sink the lookup
    }
  }
  return null;
}
