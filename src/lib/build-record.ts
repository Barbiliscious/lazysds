import type { ExtractedIndexRow, NewSDSIndexRecord, SDSSourceKind } from "@shared/types";
import { buildRecordId, computeCurrencyFlag, resolveReviewDate } from "@shared/sds-dates";

/**
 * Turns a confirmed extraction into the record that gets stored. The
 * date-derived columns (record id, review date, currency flag) are computed
 * here deterministically - never taken from the AI. Pure, so it's unit-tested
 * without touching Supabase.
 */
export function buildRecord(
  extracted: ExtractedIndexRow,
  pdfUrl: string,
  source: SDSSourceKind,
  verifiedBy: string,
  now: Date = new Date(),
): NewSDSIndexRecord {
  const issue = extracted.issue_date.status === "STATED" ? extracted.issue_date.value : null;
  const statedReview =
    extracted.review_date_stated.status === "STATED" ? extracted.review_date_stated.value : null;
  const product = extracted.product_name.value;
  const supplier = extracted.manufacturer_supplier_importer.value;

  const { date: reviewDate, calculated } = resolveReviewDate(issue, statedReview);

  return {
    record_id: buildRecordId(supplier, product, issue),
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
