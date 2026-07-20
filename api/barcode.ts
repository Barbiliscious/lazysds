import type { VercelRequest, VercelResponse } from "@vercel/node";
// Relative imports in api/ need explicit .js extensions: these run as
// native ES modules on Vercel ("type": "module"), where Node requires them.
import { lookupBarcode } from "./_lib/barcode/lookup.js";
import { isValidBarcode, normalizeBarcode } from "../shared/barcode.js";

/**
 * POST /api/barcode
 * Body: { code: string } - a retail barcode (EAN-8/13, UPC-A, GTIN-14).
 * Response: { product: ScannedProduct | null } or { error: string }.
 * null is the normal "we don't know this one" answer, not a failure. See
 * api/_lib/barcode/lookup.ts for the full resolution chain (saved mapping ->
 * database providers -> AI web-search fallback).
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  const code: unknown = (req.body as { code?: unknown } | undefined)?.code;
  if (typeof code !== "string" || !isValidBarcode(code)) {
    res.status(400).json({ error: "That doesn't look like a complete barcode - check the digits and try again." });
    return;
  }

  try {
    const product = await lookupBarcode(normalizeBarcode(code));
    res.status(200).json({ product });
  } catch (err) {
    console.error("barcode lookup failed:", err);
    res.status(502).json({ error: "The product databases couldn't be reached - try again shortly." });
  }
}
