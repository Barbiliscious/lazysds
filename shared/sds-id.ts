/**
 * The single canonicalisation rule behind both the SDS Record ID and the
 * SDS Filename: SUPPLIER-PRODUCT-ISSUEDATE, uppercased, accents stripped,
 * every run of non-alphanumeric characters collapsed to one hyphen, capped
 * at 120 characters. Record ID and Filename must never drift apart, so the
 * filename is always derived from the already-stored record_id (see
 * `sdsFilename` below) rather than recomputed independently - this function
 * is the one place the string itself gets built.
 */

const MAX_ID_LENGTH = 120;

// Unicode general category "Mark, Nonspacing" - what NFD decomposition
// splits an accented letter into (e.g. "e" + COMBINING ACUTE ACCENT).
const COMBINING_MARKS = /\p{Mn}/gu;

function canonicalisePart(value: string | null, fallback: string): string {
  const withoutAccents = (value ?? "").normalize("NFD").replace(COMBINING_MARKS, "");
  const cleaned = withoutAccents
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

/** SUPPLIER-PRODUCT-ISSUEDATE, sanitised, uppercased, capped at 120 chars. */
export function buildDeterministicId(
  supplier: string | null,
  product: string | null,
  issueDate: string | null,
): string {
  const joined = [
    canonicalisePart(supplier, "UNKNOWN"),
    canonicalisePart(product, "UNKNOWN"),
    canonicalisePart(issueDate, "NODATE"),
  ].join("-");
  return joined.slice(0, MAX_ID_LENGTH).replace(/-+$/, "");
}

/**
 * The PDF filename for a saved record. Always the stored SDS Record ID plus
 * ".pdf" - never recomputed from the record's raw fields - so the two
 * columns in an export can never disagree, even for a record saved under an
 * earlier version of `buildDeterministicId`.
 */
export function sdsFilename(recordId: string): string {
  return `${recordId}.pdf`;
}
