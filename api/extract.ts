import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
// Relative imports in api/ need explicit .js extensions: these run as
// native ES modules on Vercel ("type": "module"), where Node requires them.
import { extractSDS } from "./_lib/extraction/extract-sds.js";

/**
 * POST /api/extract
 * Body: { text: string } — plain text already extracted from the SDS PDF.
 * Response: { extracted: ExtractedSDS } or { error: string }.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  const body = req.body as { text?: unknown; pageCount?: unknown } | undefined;
  const text: unknown = body?.text;
  if (typeof text !== "string" || text.trim().length === 0) {
    res.status(400).json({ error: "Request body must be JSON with a non-empty \"text\" string" });
    return;
  }
  const pageCount = typeof body?.pageCount === "number" && body.pageCount > 0 ? body.pageCount : 1;

  try {
    const extracted = await extractSDS(text, pageCount);
    res.status(200).json({ extracted });
  } catch (err) {
    // Map SDK errors to sensible statuses; keep messages user-safe.
    if (err instanceof Anthropic.RateLimitError) {
      res.status(429).json({ error: "The AI service is busy right now — try again in a minute." });
    } else if (err instanceof Anthropic.APIConnectionError || err instanceof Anthropic.InternalServerError) {
      res.status(502).json({ error: "The AI service could not be reached — try again shortly." });
    } else {
      console.error("extract failed:", err);
      res.status(500).json({ error: "Reading the document failed. Try again, or check the PDF." });
    }
  }
}
