import Anthropic from "@anthropic-ai/sdk";

/**
 * The one place the Anthropic client is created. Server-side only —
 * ANTHROPIC_API_KEY exists solely in Vercel env vars / .env.local and
 * must never be imported from src/.
 */

// Sonnet 5, not Haiku: the standard demands verbatim excerpts, controlled
// statuses, and cross-section checks — careful reading Haiku isn't reliable
// at. Extraction volume is low (a worker adds a product now and then), so
// the per-SDS cost is small. Drop back to Haiku here to save cost if needed.
export const EXTRACTION_MODEL = "claude-sonnet-5";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to Vercel env vars (production) or .env.local (vercel dev).",
    );
  }
  client ??= new Anthropic();
  return client;
}
