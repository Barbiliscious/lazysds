import { z } from "zod";
import { getAnthropicClient } from "../anthropic.js";
import type { ScannedProduct } from "../../../shared/types.js";

/**
 * Last-resort barcode lookup: ask Claude to web-search for the barcode and
 * identify the product from real search results. Only runs after the
 * mapping table and every keyed/free barcode-database provider have missed
 * (see lookup.ts) - this is the most expensive step in the chain.
 *
 * Haiku, not Sonnet: this is "find and transcribe a product listing", not the
 * careful multi-section reading the SDS extraction needs. Verified live
 * (see git history) that Haiku searches honestly and returns no match rather
 * than guessing when nothing is found - that matters more here than raw
 * capability, since a wrong guess would look identical to a real product
 * until a human catches it.
 */
const BARCODE_SEARCH_MODEL = "claude-haiku-4-5";

const MAX_ATTEMPTS = 2;

const resultSchema = z.object({
  name: z.string().min(1),
  brand: z.string().nullable().optional(),
  manufacturerProductCode: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  variant: z.string().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  confidence: z.enum(["high", "medium", "low"]).nullable().optional(),
});

function buildPrompt(barcode: string): string {
  return `Search the web for the retail barcode ${barcode}. Identify the exact product this barcode belongs to, using only information you find in search results - never guess or fill in gaps from general knowledge. If multiple searches don't turn up a confident match, say so rather than picking the closest-sounding product.

After searching, your FINAL message must contain NOTHING except a single raw JSON value - no prose before or after it, no code fences. The JSON value is either:
(a) an object: { "name": string, "brand": string|null, "manufacturerProductCode": string|null (the manufacturer's own product/item code - NOT the barcode itself), "size": string|null (pack size/quantity), "variant": string|null (colour/scent/type), "sourceUrl": string|null (the single best source URL your answer is based on), "confidence": "high"|"medium"|"low" }
(b) if you cannot find a confident match: the bare JSON literal null`;
}

/**
 * Claude reliably does NOT follow "output only JSON" to the letter - it
 * narrates its search first, then answers, often inside a markdown code
 * fence. So we don't require strict compliance: pull the LAST JSON object
 * out of the full response text (there's normally only one), and treat a
 * trailing bare "null" as an honest "no match" rather than a parse failure.
 * Returns: an object on success, `null` for an explicit no-match, or
 * `undefined` when nothing usable could be extracted (caller retries).
 */
export function extractJsonPayload(text: string): unknown | null | undefined {
  // One level of nesting is enough - our schema is flat, so this won't
  // mis-bracket across separate objects in narration text.
  const objectMatches = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g);
  if (objectMatches && objectMatches.length > 0) {
    const last = objectMatches[objectMatches.length - 1]!;
    try {
      return JSON.parse(last) as unknown;
    } catch {
      // fall through to the null check below
    }
  }
  if (/\bnull\s*$/i.test(text.trim())) return null;
  return undefined;
}

export async function lookupBarcodeViaWebSearch(barcode: string): Promise<ScannedProduct | null> {
  const client = getAnthropicClient();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let response;
    try {
      response = await client.messages.create({
        model: BARCODE_SEARCH_MODEL,
        max_tokens: 1500,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
        messages: [{ role: "user", content: buildPrompt(barcode) }],
      });
    } catch {
      return null; // network/API error - a miss here just means the chain falls through
    }

    if (response.stop_reason === "refusal") return null;

    const text = response.content.map((block) => (block.type === "text" ? block.text : "")).join("\n");
    const payload = extractJsonPayload(text);

    if (payload === null) return null; // Claude explicitly found nothing
    if (payload === undefined) continue; // unparseable - retry once

    const parsed = resultSchema.safeParse(payload);
    if (!parsed.success) continue; // wrong shape - retry once

    return {
      barcode,
      name: parsed.data.name,
      brand: parsed.data.brand ?? null,
      manufacturerProductCode: parsed.data.manufacturerProductCode ?? null,
      size: parsed.data.size ?? null,
      variant: parsed.data.variant ?? null,
      sourceUrl: parsed.data.sourceUrl ?? null,
      sourceProvider: "web_search",
      confidence: parsed.data.confidence ?? "low",
    };
  }

  return null; // couldn't get a usable answer in MAX_ATTEMPTS - treat as a miss, not an error
}
