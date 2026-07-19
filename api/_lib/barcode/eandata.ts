import type { BarcodeProduct } from "./open-facts.js";

/**
 * Server-only adapter for eandata.com (UPC/EAN v3 data feed).
 *
 * The keycode is supplied by lookup.ts from EANDATA_API_KEY; it is sent only
 * from the server and never included in the browser bundle. The free tier is
 * rate-limited (a small number of lookups a day) and masks some premium
 * attributes as ***value*** - masked or empty values are treated as "no data",
 * so a miss or an exhausted allowance falls through to the next provider.
 *
 * Response shape (v3), product name and brand only:
 *   { "status": { "code": "200" },
 *     "product": { "attributes": { "product": "...", "brand": "..." } },
 *     "company": { "name": "..." } }
 */

interface EandataResponse {
  status?: { code?: unknown };
  product?: { attributes?: { product?: unknown; brand?: unknown } };
  company?: { name?: unknown };
}

/** Empty, or a free-tier masked ***value*** placeholder, counts as no data. */
function usableText(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (trimmed === "" || (trimmed.startsWith("***") && trimmed.endsWith("***"))) return "";
  return trimmed;
}

/** Pulls a product name and brand from the documented v3 response. */
export function parseEandataResponse(json: unknown): BarcodeProduct | null {
  if (typeof json !== "object" || json === null) return null;
  const body = json as EandataResponse;
  if (String(body.status?.code ?? "") !== "200") return null;

  const attributes = body.product?.attributes;
  const name = usableText(attributes?.product);
  if (name === "") return null;

  // Brand is often blank; the company name (the manufacturer) is a good
  // stand-in for a chemical product's brand.
  const brand = usableText(attributes?.brand) || usableText(body.company?.name);
  return { name, brand: brand === "" ? null : brand };
}

export async function lookupEandataBarcode(code: string, keycode: string): Promise<BarcodeProduct | null> {
  const params = new URLSearchParams({
    v: "3",
    keycode,
    mode: "json",
    find: code,
    get: "product,brand,company",
  });
  const response = await fetch(`https://eandata.com/feed/?${params.toString()}`, {
    signal: AbortSignal.timeout(6_000),
    headers: { "User-Agent": "LazySDS/1.0 (https://lazysds.vercel.app)" },
  });

  // A miss, exhausted allowance or temporary provider problem should not block
  // the worker - the UI can still fall back to a normal web search.
  if (!response.ok) return null;
  return parseEandataResponse(await response.json());
}
