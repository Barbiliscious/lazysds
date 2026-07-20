import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isValidBarcode, normalizeBarcode } from "../shared/barcode.js";
import { saveMapping } from "./_lib/barcode/mapping.js";
import type { ScannedProduct } from "../shared/types.js";

/**
 * POST /api/barcode-mapping
 * Body: a worker-confirmed ScannedProduct, plus optional verifiedBy initials.
 * Saves it as the mapping for that barcode (migration 0004) so every later
 * scan of the same barcode is answered instantly, without calling any
 * external provider or the AI web-search fallback again.
 *
 * Nothing here is written without a human confirming it first - this route
 * is only ever called from the scan page's "confirm" action, never
 * automatically from the lookup itself.
 */

function readOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  const body = req.body as Partial<ScannedProduct> & { verifiedBy?: unknown } | undefined;
  const barcode = typeof body?.barcode === "string" ? normalizeBarcode(body.barcode) : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!isValidBarcode(barcode)) {
    res.status(400).json({ error: "That doesn't look like a complete barcode." });
    return;
  }
  if (name === "") {
    res.status(400).json({ error: "A product name is required to save this mapping." });
    return;
  }

  const product: ScannedProduct = {
    barcode,
    name,
    brand: readOptionalString(body?.brand),
    manufacturerProductCode: readOptionalString(body?.manufacturerProductCode),
    size: readOptionalString(body?.size),
    variant: readOptionalString(body?.variant),
    sourceUrl: readOptionalString(body?.sourceUrl),
    sourceProvider: readOptionalString(body?.sourceProvider),
    confidence: null,
  };

  try {
    await saveMapping(product, readOptionalString(body?.verifiedBy));
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("saving barcode mapping failed:", err);
    res.status(502).json({ error: "Could not save this for next time, but you can still continue." });
  }
}
