import type { SDSField, SDSFieldKey } from "@shared/types";

/**
 * Which SDS section each field belongs to. Used to line the extracted fields
 * up beside the matching section of the source PDF on the approval screen.
 *
 * The AI already records where it read each value (e.g. "Section 8, SDS page
 * 2"), so we prefer that. When a field is NOT_STATED (no location) we fall
 * back to the section the GHS standard puts it in, so it still lands in a
 * sensible place.
 */

/** Standard GHS 16-section home for each field. */
export const CANONICAL_SECTION: Record<SDSFieldKey, number> = {
  product_name: 1,
  manufacturer_supplier_importer: 1,
  product_codes: 1,
  issue_date: 1,
  review_date_stated: 1,
  hazardous_chemical: 2,
  dangerous_goods: 14,
  signal_word: 2,
  hazard_statements: 2,
  ppe: 8,
  first_aid: 4,
  spill: 6,
  storage: 7,
  fire_media: 5,
};

const SECTION_RE = /\bsection\s+(\d{1,2})\b/i;

/** Reads the section number from an AI evidence location, if present. */
export function firstSdsSection(location: string | null): number | null {
  if (!location) return null;
  const match = SECTION_RE.exec(location);
  if (!match?.[1]) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(n) && n >= 1 && n <= 16 ? n : null;
}

/** The SDS section a field belongs to: its cited section, else the canonical one. */
export function sectionForField(key: SDSFieldKey, field: SDSField): number {
  return firstSdsSection(field.location) ?? CANONICAL_SECTION[key];
}
