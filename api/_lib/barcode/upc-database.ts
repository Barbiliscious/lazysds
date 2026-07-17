import type { BarcodeProduct } from "./open-facts.js";

/**
 * Server-only adapter for UPC Database.
 *
 * The API token is supplied by lookup.ts from UPC_DATABASE_API_KEY. It is
 * sent as a Bearer token and is never included in the browser bundle.
 */

interface UpcDatabaseResponse {
  success?: unknown;
  title?: unknown;
  alias?: unknown;
  brand?: unknown;
  manufacturer?: unknown;
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return "";
}

/** Pulls a useful product name and brand from the documented API response. */
export function parseUpcDatabaseResponse(json: unknown): BarcodeProduct | null {
  if (typeof json !== "object" || json === null) return null;
  const body = json as UpcDatabaseResponse;
  if (body.success !== true && body.success !== "true") return null;

  const name = firstText(body.title, body.alias);
  if (name === "") return null;

  const brand = firstText(body.brand, body.manufacturer);
  return { name, brand: brand === "" ? null : brand };
}

export async function lookupUpcDatabaseBarcode(code: string, apiKey: string): Promise<BarcodeProduct | null> {
  const response = await fetch(`https://api.upcdatabase.org/product/${encodeURIComponent(code)}`, {
    signal: AbortSignal.timeout(6_000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "User-Agent": "LazySDS/1.0 (https://lazysds.vercel.app)",
    },
  });

  // A miss, exhausted allowance or temporary provider problem should not
  // block the worker. The UI can still fall back to a normal web search.
  if (!response.ok) return null;
  return parseUpcDatabaseResponse(await response.json());
}
