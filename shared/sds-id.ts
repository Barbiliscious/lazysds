/**
 * The SDS-NNN numbering scheme (see the export spec, 2026-08-06): record_id
 * is assigned server-side by a Postgres trigger
 * (supabase/migrations/0005_sds_number_scheme.sql) as "SDS-" plus a
 * zero-padded ascending number - this file never generates it, and it can
 * never change once assigned.
 *
 * What this file DOES generate is `filename_stem`, a short contraction of
 * the product name (e.g. "Aquanamel") that a human confirms/edits on the
 * review screen before first save, and the combiner that joins a record's
 * stem to the number parsed back out of its own record_id to produce the
 * full "SDS Filename" shown in exports (e.g. "Aquanamel-042"). The number
 * is never stored a second time, so SDS Record ID and SDS Filename can
 * never disagree on it.
 */

const MAX_STEM_LENGTH = 40;

// Unicode general category "Mark, Nonspacing" - what NFD decomposition
// splits an accented letter into (e.g. "e" + COMBINING ACUTE ACCENT).
const COMBINING_MARKS = /\p{Mn}/gu;

/**
 * A naive, deterministic starting suggestion for the SDS Filename stem:
 * the product name cleaned to the SharePoint-safe character set (letters,
 * numbers, hyphen only) and capped at 40 characters. Not an attempt at a
 * "smart" contraction - it's a pre-fill a human confirms or shortens on the
 * review screen, never written to the register unedited-but-unseen.
 */
export function buildFilenameStem(productName: string | null): string {
  const withoutAccents = (productName ?? "").normalize("NFD").replace(COMBINING_MARKS, "");
  const cleaned = withoutAccents
    .replace(/[^A-Za-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  const truncated = cleaned.slice(0, MAX_STEM_LENGTH).replace(/-+$/, "");
  return truncated || "SDS";
}

/** Pulls the zero-padded number out of a "SDS-042"-style record id. */
function recordNumber(recordId: string): string {
  const match = /^SDS-(\d+)$/.exec(recordId);
  return match ? match[1]! : "000";
}

/**
 * The "SDS Filename" shown in exports: a record's filename_stem plus the
 * number from its own record_id - no ".pdf" extension. Callers append that
 * when naming the actual PDF file or building the SharePoint link (see
 * cellText's sds_filename/sds_link cases in export-register.ts and the zip
 * naming in download-batch.ts) - never regenerated independently.
 */
export function sdsFilename(filenameStem: string, recordId: string): string {
  return `${filenameStem}-${recordNumber(recordId)}`;
}
