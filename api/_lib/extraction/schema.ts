import { z } from "zod";
import type { ExtractedIndexRow } from "../../../shared/types.js";

/**
 * Zod mirror of ExtractedIndexRow in shared/types.ts. Used two ways:
 *  - passed to the Anthropic API as a structured-output format, so the model
 *    is constrained to this exact shape server-side;
 *  - used to validate the response before it leaves /api/extract.
 * The assertion at the bottom fails the compiler if it drifts from the
 * shared interface.
 */

export const fieldStatus = z.enum([
  "STATED",
  "NOT_STATED",
  "NOT_AVAILABLE",
  "NOT_APPLICABLE",
  "NONE_ALLOCATED",
  "NOT_CLASSIFIED",
  "UNREADABLE",
  "CONFLICTING",
  "NA_UNCLEAR",
]);

export const extractionStatus = z.enum([
  "READY_FOR_HUMAN_REVIEW",
  "MANUAL_REVIEW_REQUIRED",
  "INCOMPLETE_SOURCE",
]);

/** One value plus its evidence. */
export const sdsField = z.object({
  value: z.string().nullable(),
  status: fieldStatus,
  excerpt: z.string().nullable(),
  location: z.string().nullable(),
});

export const extractedSDSSchema = z.object({
  product_name: sdsField,
  manufacturer: sdsField,
  supplier_importer: sdsField,
  product_codes: sdsField,
  issue_date: sdsField,
  review_date_stated: sdsField,
  hazardous_chemical: sdsField,
  dangerous_goods: sdsField,
  signal_word: sdsField,
  pictograms: sdsField,
  hazard_statements: sdsField,
  poisons_schedule: sdsField,
  un_number: sdsField,
  dg_class: sdsField,
  packing_group: sdsField,
  ppe_eyes_face: sdsField,
  ppe_hands: sdsField,
  ppe_respiratory: sdsField,
  ppe_body: sdsField,
  first_aid: sdsField,
  spill: sdsField,
  storage: sdsField,
  incompatibilities: sdsField,
  fire_media: sdsField,
  dilution_condition: sdsField,
  extraction_status: extractionStatus,
  review_reasons: z.array(z.string()),
});

// Compile-time drift check: z.infer must be assignable to ExtractedIndexRow
// and vice versa. If either direction breaks, tsc fails here.
type Inferred = z.infer<typeof extractedSDSSchema>;
const _schemaMatchesSharedType: ExtractedIndexRow = {} as Inferred;
const _sharedTypeMatchesSchema: Inferred = {} as ExtractedIndexRow;
void _schemaMatchesSharedType;
void _sharedTypeMatchesSchema;
