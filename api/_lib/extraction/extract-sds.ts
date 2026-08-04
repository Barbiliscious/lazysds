import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ExtractedIndexRow } from "../../../shared/types.js";
import { getAnthropicClient, EXTRACTION_MODEL } from "../anthropic.js";
import { extractedSDSSchema } from "./schema.js";
import { EXTRACTION_SYSTEM_PROMPT, buildExtractionUserMessage } from "./prompt.js";

/**
 * Very generous cap that still fits the model's context with room to spare.
 * A typical SDS is 5-20 pages; anything past this is boilerplate we drop.
 */
const MAX_INPUT_CHARS = 300_000;

/** The output is 15 fields x {value,status,excerpt,location} + reasons. */
const MAX_OUTPUT_TOKENS = 12_000;

const MAX_ATTEMPTS = 2;

/**
 * Runs the extraction with a structured-output format: the API constrains the
 * response to extractedSDSSchema server-side, so the model cannot return
 * prose or a malformed shape. Thinking is disabled to keep the call fast,
 * cheap, and deterministic - this is careful reading, not open reasoning.
 * parsed_output is additionally validated by zod. One retry as belt-and-braces.
 */
export async function extractSDS(
  pageTaggedText: string,
  pageCount: number,
): Promise<ExtractedIndexRow> {
  const client = getAnthropicClient();
  const userMessage = buildExtractionUserMessage(
    pageTaggedText.slice(0, MAX_INPUT_CHARS),
    pageCount,
  );

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await client.messages.parse({
        model: EXTRACTION_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        thinking: { type: "disabled" },
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
    }
  }
  throw lastError;
}
