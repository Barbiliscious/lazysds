import type { SDSFieldKey } from "../types";

/**
 * ═══════════════════════════════════════════════════════════════════
 *  EDIT ME — register export column order (32 columns)
 * ═══════════════════════════════════════════════════════════════════
 * This one file controls the CSV/XLSX export order and headings.
 *  - `header` is the column heading exactly as it appears in the file.
 *  - `ref` is where the cell text comes from:
 *      { field: <key> }   → the extracted SDS field's value/status
 *      { record: <token> }→ a value derived in code (id, dates, admin)
 *  - Reorder entries to reorder columns; delete entries to drop columns.
 * The renderer lives in src/lib/export-register.ts.
 */

export type RecordColumn =
  | "record_id" // 1
  | "sds_link" // 6
  | "review_date" // 8
  | "currency_flag" // 9
  | "extraction_status" // 29
  | "review_reasons" // 30
  | "verified_by" // 31
  | "verified_at"; // 32

export type ColumnRef = { field: SDSFieldKey } | { record: RecordColumn };

export interface RegisterColumn {
  header: string;
  ref: ColumnRef;
}

export const REGISTER_COLUMNS: RegisterColumn[] = [
  { header: "SDS Record ID", ref: { record: "record_id" } },
  { header: "Product Name", ref: { field: "product_name" } },
  { header: "Manufacturer", ref: { field: "manufacturer" } },
  { header: "Supplier / Importer", ref: { field: "supplier_importer" } },
  { header: "Product Codes", ref: { field: "product_codes" } },
  { header: "SDS Link", ref: { record: "sds_link" } },
  { header: "Issue / Revision Date", ref: { field: "issue_date" } },
  { header: "Review Date", ref: { record: "review_date" } },
  { header: "Currency Flag", ref: { record: "currency_flag" } },
  { header: "Hazardous Chemical?", ref: { field: "hazardous_chemical" } },
  { header: "Dangerous Goods?", ref: { field: "dangerous_goods" } },
  { header: "Signal Word", ref: { field: "signal_word" } },
  { header: "Pictograms", ref: { field: "pictograms" } },
  { header: "Hazard Statements", ref: { field: "hazard_statements" } },
  { header: "Poisons Schedule", ref: { field: "poisons_schedule" } },
  { header: "UN Number", ref: { field: "un_number" } },
  { header: "DG Class / Subsidiary Risk", ref: { field: "dg_class" } },
  { header: "Packing Group", ref: { field: "packing_group" } },
  { header: "PPE - Eyes / Face", ref: { field: "ppe_eyes_face" } },
  { header: "PPE - Hands", ref: { field: "ppe_hands" } },
  { header: "PPE - Respiratory", ref: { field: "ppe_respiratory" } },
  { header: "PPE - Body", ref: { field: "ppe_body" } },
  { header: "First Aid - Key Points", ref: { field: "first_aid" } },
  { header: "Spill - Key Points", ref: { field: "spill" } },
  { header: "Storage - Key Points", ref: { field: "storage" } },
  { header: "Incompatibilities", ref: { field: "incompatibilities" } },
  { header: "Fire - Extinguishing Media", ref: { field: "fire_media" } },
  { header: "Dilution / Use Condition", ref: { field: "dilution_condition" } },
  { header: "Extraction Status", ref: { record: "extraction_status" } },
  { header: "Review Reasons", ref: { record: "review_reasons" } },
  { header: "Verified By", ref: { record: "verified_by" } },
  { header: "Verified Date", ref: { record: "verified_at" } },
];
