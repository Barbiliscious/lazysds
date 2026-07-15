import type { CurrencyFlag } from "./types";

/**
 * Deterministic date + currency logic for the index. Kept OUT of the AI's
 * hands on purpose: dates and the 5-year currency rule are exact arithmetic,
 * not judgement, so a human can trust them without a source excerpt.
 *
 * SDS dates come in three precisions and we never invent missing parts:
 *   YYYY-MM-DD  full date
 *   YYYY-MM     month + year ("November 2020" -> "2020-11")
 *   YYYY        year only
 */

export interface ParsedSdsDate {
  year: number;
  month: number | null; // 1-12
  day: number | null; // 1-31
}

/** Parses a YYYY / YYYY-MM / YYYY-MM-DD string. Returns null if malformed. */
export function parseSdsDate(raw: string | null | undefined): ParsedSdsDate | null {
  if (!raw) return null;
  const m = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(raw.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = m[2] === undefined ? null : Number(m[2]);
  const day = m[3] === undefined ? null : Number(m[3]);
  if (month !== null && (month < 1 || month > 12)) return null;
  if (day !== null && (day < 1 || day > 31)) return null;
  return { year, month, day };
}

/** The earliest instant a partial date could refer to (missing parts -> 1). */
function startOf(d: ParsedSdsDate): Date {
  return new Date(Date.UTC(d.year, (d.month ?? 1) - 1, d.day ?? 1));
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Re-serialises a parsed date at its original precision. */
export function formatSdsDate(d: ParsedSdsDate): string {
  if (d.month === null) return String(d.year);
  if (d.day === null) return `${d.year}-${pad(d.month)}`;
  return `${d.year}-${pad(d.month)}-${pad(d.day)}`;
}

/** Issue date + 5 years, preserving the original precision (never adds a day). */
export function addFiveYears(issue: string): string | null {
  const d = parseSdsDate(issue);
  if (!d) return null;
  return formatSdsDate({ ...d, year: d.year + 5 });
}

export interface ResolvedReviewDate {
  date: string | null;
  calculated: boolean;
}

/**
 * Column 8. Prefer the SDS's own review-by date; otherwise Issue + 5 years.
 * `calculated` is true only when we fell back to the arithmetic.
 */
export function resolveReviewDate(
  issueDate: string | null,
  statedReviewDate: string | null,
): ResolvedReviewDate {
  if (statedReviewDate && parseSdsDate(statedReviewDate)) {
    return { date: statedReviewDate, calculated: false };
  }
  if (issueDate && parseSdsDate(issueDate)) {
    return { date: addFiveYears(issueDate), calculated: true };
  }
  return { date: null, calculated: false };
}

/**
 * Column 9. POSSIBLY_OUTDATED if the review date has passed or the issue
 * date is more than five years old; DATE_UNCONFIRMED if no date was found;
 * CURRENT otherwise. `today` is injectable for testing.
 */
export function computeCurrencyFlag(
  issueDate: string | null,
  reviewDate: string | null,
  today: Date = new Date(),
): CurrencyFlag {
  const issue = parseSdsDate(issueDate);
  const review = parseSdsDate(reviewDate);
  if (!issue && !review) return "DATE_UNCONFIRMED";

  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  const reviewPassed = review !== null && startOf(review).getTime() < now;

  let issueTooOld = false;
  if (issue) {
    const fiveYearsOn = startOf({ ...issue, year: issue.year + 5 }).getTime();
    issueTooOld = fiveYearsOn < now;
  }

  return reviewPassed || issueTooOld ? "POSSIBLY_OUTDATED" : "CURRENT";
}

/** Column 1. A stable-ish id: SUPPLIER-PRODUCT-ISSUEDATE, sanitised. */
export function buildRecordId(
  supplier: string | null,
  product: string | null,
  issueDate: string | null,
): string {
  const part = (s: string | null, fallback: string) => {
    const cleaned = (s ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return cleaned || fallback;
  };
  return [part(supplier, "UNKNOWN"), part(product, "UNKNOWN"), part(issueDate, "NODATE")].join("-");
}
