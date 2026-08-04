import type { SDSFieldKey } from "../types";

/**
 * ═══════════════════════════════════════════════════════════════════
 *  EDIT ME - register export layout (the "SDS Index" spreadsheet)
 * ═══════════════════════════════════════════════════════════════════
 * A condensed, grouped view of the index - matches the Grampians example
 * workbook. This one file controls the CSV/XLSX columns, their order, their
 * group bands, and their headings.
 *  - `group` is the coloured band above the column (blank = no band).
 *  - `header` is the column heading.
 *  - `ref` is where the cell text comes from:
 *      { field: <key> }    → an extracted SDS field's value/status
 *      { record: <token> } → a value derived in code (id, dates, admin, link)
 *  - Reorder / delete entries to change the sheet. The renderer (banner,
 *    bands, bold line-labels in PPE / First Aid, hyperlink) lives in
 *    src/lib/export-register.ts.
 */

export type RecordColumn =
  | "record_id"
  | "review_date"
  | "extraction_status"
  | "review_reasons"
  | "verified_by"
  | "verified_at"
  | "sds_link";

export type ColumnRef = { field: SDSFieldKey } | { record: RecordColumn };

export interface RegisterColumn {
  group: string;
  header: string;
  ref: ColumnRef;
}

export const REGISTER_COLUMNS: RegisterColumn[] = [
  { group: "IDENTIFICATION", header: "SDS Record ID", ref: { record: "record_id" } },
  { group: "IDENTIFICATION", header: "Product Name", ref: { field: "product_name" } },
  { group: "IDENTIFICATION", header: "Manufacturer / Supplier / Importer", ref: { field: "manufacturer_supplier_importer" } },
  { group: "IDENTIFICATION", header: "Product Codes", ref: { field: "product_codes" } },
  { group: "DOCUMENT CONTROL", header: "Issue Date", ref: { field: "issue_date" } },
  { group: "DOCUMENT CONTROL", header: "Review Date", ref: { record: "review_date" } },
  { group: "HAZARD AT A GLANCE", header: "Hazardous Chemical?", ref: { field: "hazardous_chemical" } },
  { group: "HAZARD AT A GLANCE", header: "Dangerous Goods?", ref: { field: "dangerous_goods" } },
  { group: "HAZARD AT A GLANCE", header: "Signal Word", ref: { field: "signal_word" } },
  { group: "HAZARD AT A GLANCE", header: "Hazard Classification", ref: { field: "hazard_classification" } },
  { group: "HAZARD AT A GLANCE", header: "Hazard Statements", ref: { field: "hazard_statements" } },
  { group: "QUICK RESPONSE", header: "PPE", ref: { field: "ppe" } },
  { group: "QUICK RESPONSE", header: "First Aid - Key Points", ref: { field: "first_aid" } },
  { group: "QUICK RESPONSE", header: "Spill - Key Points", ref: { field: "spill" } },
  { group: "QUICK RESPONSE", header: "Storage - Key Points", ref: { field: "storage" } },
  { group: "QUICK RESPONSE", header: "Fire - Extinguishing Media", ref: { field: "fire_media" } },
  { group: "REGISTER ADMIN", header: "Extraction Status", ref: { record: "extraction_status" } },
  { group: "REGISTER ADMIN", header: "Review Reasons", ref: { record: "review_reasons" } },
  { group: "REGISTER ADMIN", header: "Verified By", ref: { record: "verified_by" } },
  { group: "REGISTER ADMIN", header: "Verified Date", ref: { record: "verified_at" } },
  { group: "", header: "SDS Link", ref: { record: "sds_link" } },
];

/** The mandatory notice, printed as the banner row of the export. */
export const QUICK_REFERENCE_BANNER =
  "QUICK REFERENCE ONLY - This index does not replace the manufacturer's Safety Data Sheet or a workplace risk assessment. Open the linked SDS for complete instructions. If any information differs, follow the source SDS and report the discrepancy for review.";
