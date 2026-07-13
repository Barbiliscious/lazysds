import Anthropic from "@anthropic-ai/sdk";

/**
 * The one place the Anthropic client is created. Server-side only —
 * ANTHROPIC_API_KEY exists solely in Vercel env vars / .env.local and
 * must never be imported from src/.
 */

export const EXTRACTION_MODEL = "claude-haiku-4-5-20251001";

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
