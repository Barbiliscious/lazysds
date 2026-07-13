import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ExtractedSDS } from "../../../shared/types";
import { getAnthropicClient, EXTRACTION_MODEL } from "../anthropic";
import { extractedSDSSchema } from "./schema";
import { EXTRACTION_SYSTEM_PROMPT, buildExtractionUserMessage } from "./prompt";

/**
 * Very generous cap (~75k tokens) that still fits Haiku's 200k context with
 * room to spare. A typical SDS is 5-20 pages; anything past this length is
 * boilerplate we can safely drop.
 */
const MAX_INPUT_CHARS = 300_000;

/** Output is a small fixed-shape JSON object; 2000 tokens is ample. */
const MAX_OUTPUT_TOKENS = 2_000;

const MAX_ATTEMPTS = 2;

/**
 * Runs the extraction against Claude Haiku with a structured-output format:
 * the API constrains the response to extractedSDSSchema server-side, so the
 * model cannot return prose, fences, or a malformed shape. parsed_output is
 * additionally validated by zod client-side. One retry as belt-and-braces.
 */
export async function extractSDS(sdsText: string): Promise<ExtractedSDS> {
  const client = getAnthropicClient();
  const userMessage = buildExtractionUserMessage(sdsText.slice(0, MAX_INPUT_CHARS));

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await client.messages.parse({
        model: EXTRACTION_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: EXTRACTION_SYSTEM_PROMPT,
        output_config: { format: zodOutputFormat(extractedSDSSchema) },
        messages: [{ role: "user", content: userMessage }],
      });

      if (response.parsed_output) {
        return response.parsed_output;
      }
      // Schema-constrained output should always parse; reaching here means
      // the response was truncated or refused. Retry once.
      lastError = new Error(`Extraction returned no parseable output (stop_reason: ${response.stop_reason})`);
    } catch (err) {
      lastError = err;
      // API-level errors (rate limit, overload) are retried once too; the
      // route handler maps whatever we finally throw to an HTTP status.
    }
  }
  throw lastError;
}
