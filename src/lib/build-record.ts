import type { ExtractedIndexRow, NewSDSIndexRecord, SDSSourceKind } from "@shared/types";
import { computeCurrencyFlag, resolveReviewDate } from "@shared/sds-dates";

/**
 * Turns a confirmed extraction into the record that gets stored. The
 * date-derived columns (review date, currency flag) are computed here
 * deterministically - never taken from the AI. Pure, so it's unit-tested
 * without touching Supabase. record_id isn't part of this: it's assigned
 * server-side at insert (migration 0005) and never sent by the client.
 * filenameStem is the human-confirmed value from the review screen, not
 * recomputed here.
 */
export function buildRecord(
  extracted: ExtractedIndexRow,
  pdfUrl: string,
  source: SDSSourceKind,
  verifiedBy: string,
  filenameStem: string,
  now: Date = new Date(),
): NewSDSIndexRecord {
  const issue = extracted.issue_date.status === "STATED" ? extracted.issue_date.value : null;
  const statedReview =
    extracted.review_date_stated.status === "STATED" ? extracted.review_date_stated.value : null;

  const { date: reviewDate, calculated } = resolveReviewDate(issue, statedReview);

  return {
    filename_stem: filenameStem,
    pdf_url: pdfUrl,
    extracted,
    review_date: reviewDate,
    review_date_calculated: calculated,
    currency_flag: computeCurrencyFlag(issue, reviewDate, now),
    source,
    verified_by: verifiedBy,
    verified_at: now.toISOString(),
  };
}
