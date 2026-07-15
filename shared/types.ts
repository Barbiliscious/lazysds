/**
 * Domain types shared between the React app (src/) and the serverless
 * functions (api/). This file is the single source of truth for the shape
 * of an SDS quick-reference index row.
 *
 * Model: ONE row per SDS. The row is an index entry that points at the
 * source SDS - never a substitute for it. Every value the AI writes carries
 * its own evidence (a verbatim source excerpt + where it came from) so a
 * human can verify it at a glance on the approval screen. If the AI can't
 * quote a source for a value, it must return a status instead of a value.
 */

/** Where a record's SDS PDF came from. */
export type SDSSourceKind = "upload" | "pubchem" | "web_search";

/**
 * Controlled statuses. These are NOT interchangeable - each means a
 * different thing in a safety context (see the extraction standard).
 * Stored as tokens; human-readable strings live in shared/sds-fields.ts.
 */
export type FieldStatus =
  | "STATED" // a value is present
  | "NOT_STATED" // the section exists but the value isn't in it
  | "NOT_AVAILABLE" // the SDS explicitly says "not available" / "no data"
  | "NOT_APPLICABLE" // the SDS explicitly says "not applicable"
  | "NONE_ALLOCATED" // the SDS explicitly says "none allocated"
  | "NOT_CLASSIFIED" // the SDS explicitly says not classified for that category
  | "UNREADABLE" // text is present but can't be read reliably
  | "CONFLICTING" // two parts of the SDS disagree (both recorded)
  | "NA_UNCLEAR"; // "N/A" used without the SDS defining which N/A

/**
 * One extracted value plus the evidence behind it. When status is "STATED",
 * `value` holds the cell text and `excerpt`/`location` MUST be present.
 * For every other status, `value` is null and the status carries the meaning.
 */
export interface SDSField {
  value: string | null;
  status: FieldStatus;
  /** Verbatim sentence/phrase from the SDS the value came from. */
  excerpt: string | null;
  /** e.g. "Section 2, SDS page 2". */
  location: string | null;
}

/** The AI's own verdict on the extraction. It may NEVER set "APPROVED". */
export type ExtractionStatus =
  | "READY_FOR_HUMAN_REVIEW"
  | "MANUAL_REVIEW_REQUIRED"
  | "INCOMPLETE_SOURCE";

/** The 24 SDS-derived fields the AI reads, each with its evidence. */
export type SDSFieldKey =
  | "product_name"
  | "manufacturer_supplier_importer"
  | "product_codes"
  | "issue_date"
  | "review_date_stated"
  | "hazardous_chemical"
  | "dangerous_goods"
  | "signal_word"
  | "pictograms"
  | "hazard_statements"
  | "poisons_schedule"
  | "un_number"
  | "dg_class"
  | "packing_group"
  | "ppe_eyes_face"
  | "ppe_hands"
  | "ppe_respiratory"
  | "ppe_body"
  | "first_aid"
  | "spill"
  | "storage"
  | "incompatibilities"
  | "fire_media"
  | "dilution_condition";

/** What the AI returns: one field-with-evidence per key, plus its verdict. */
export type ExtractedIndexRow = {
  [K in SDSFieldKey]: SDSField;
} & {
  extraction_status: ExtractionStatus;
  /** One reason per line for a MANUAL_REVIEW_REQUIRED / INCOMPLETE_SOURCE verdict. */
  review_reasons: string[];
};

/** Column 9. Derived from dates in code, never by the AI. */
export type CurrencyFlag = "CURRENT" | "POSSIBLY_OUTDATED" | "DATE_UNCONFIRMED";

/** A confirmed row in the register. */
export interface SDSIndexRecord {
  id: string;
  /** Column 1 - SUPPLIER-PRODUCT-ISSUEDATE, built in code. */
  record_id: string;
  /** Column 6 - the link to the stored PDF. Every row must have one. */
  pdf_url: string;
  extracted: ExtractedIndexRow;
  /** Column 8 - stated review-by date, or Issue + 5 years. */
  review_date: string | null;
  /** True when review_date was calculated rather than read from the SDS. */
  review_date_calculated: boolean;
  /** Column 9 - derived from the dates. */
  currency_flag: CurrencyFlag;
  source: SDSSourceKind;
  /** Column 31 - human only. In this app, saving IS the human confirmation. */
  verified_by: string;
  /** Column 32 - set to now() at save time. */
  verified_at: string;
  created_at: string;
}

/** What the human supplies when confirming a record on the approval screen. */
export type NewSDSIndexRecord = Omit<SDSIndexRecord, "id" | "created_at">;
