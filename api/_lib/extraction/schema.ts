import { z } from "zod";
import type { ExtractedSDS } from "../../../shared/types";

/**
 * Zod mirror of the ExtractedSDS interface in shared/types.ts.
 * Used two ways:
 *  - passed to the Anthropic API as a structured-output format, so the model
 *    is constrained to this exact shape server-side;
 *  - used to validate the response before it leaves /api/extract.
 * The assertion at the bottom makes the compiler fail if this drifts from
 * the shared interface.
 */

export const confidenceLevel = z.enum(["high", "low"]);

export const extractedSDSSchema = z.object({
  product_name: z.string().nullable(),
  manufacturer: z.string().nullable(),
  supplier: z.string().nullable(),
  is_hazardous: z.boolean().nullable(),
  dangerous_goods_class: z.string().nullable(),
  un_number: z.string().nullable(),
  issue_date: z.string().nullable(),
  hazard_statements: z.array(z.string()),
  confidence: z.object({
    product_name: confidenceLevel,
    manufacturer: confidenceLevel,
    is_hazardous: confidenceLevel,
  }),
});

// Compile-time drift check: z.infer of the schema must be assignable to
// ExtractedSDS and vice versa. If either direction breaks, tsc fails here.
type Inferred = z.infer<typeof extractedSDSSchema>;
const _schemaMatchesSharedType: ExtractedSDS = {} as Inferred;
const _sharedTypeMatchesSchema: Inferred = {} as ExtractedSDS;
void _schemaMatchesSharedType;
void _sharedTypeMatchesSchema;
