/**
 * Domain types shared between the React app (src/) and the serverless
 * functions (api/). This file is the single source of truth for the shape
 * of an SDS record — if the extraction schema changes, change it here first.
 */

export type Confidence = "high" | "low";

/** Where a record's SDS PDF came from. */
export type SDSSourceKind = "upload" | "pubchem" | "web_search";

/**
 * What Claude extracts from an SDS document.
 * null means "not clearly stated in the document" — never a guess.
 */
export interface ExtractedSDS {
  product_name: string | null;
  manufacturer: string | null;
  supplier: string | null;
  is_hazardous: boolean | null;
  dangerous_goods_class: string | null;
  un_number: string | null;
  /** Kept as a string: SDS issue dates come in too many formats to parse reliably. */
  issue_date: string | null;
  hazard_statements: string[];
  confidence: {
    product_name: Confidence;
    manufacturer: Confidence;
    is_hazardous: Confidence;
  };
}

/** A confirmed row in the sds_records table. */
export interface SDSRecord extends ExtractedSDS {
  id: string;
  pdf_url: string | null;
  source: SDSSourceKind;
  reviewed_by: string;
  created_at: string;
}

/** What the user supplies when confirming a record on the review screen. */
export type NewSDSRecord = Omit<SDSRecord, "id" | "created_at">;
