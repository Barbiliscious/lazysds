import type { SDSRecord } from "../types";

/**
 * ═══════════════════════════════════════════════════════════════════
 *  EDIT ME — register export column mapping
 * ═══════════════════════════════════════════════════════════════════
 * This one file controls the CSV/XLSX export format.
 *  - `header` is the column heading exactly as it appears in the file.
 *  - `field`  is which record field fills the column.
 *  - Reorder entries to reorder columns; delete entries to drop columns.
 * Nothing else needs to change when you tweak this.
 */

export interface RegisterColumn {
  header: string;
  field: keyof SDSRecord;
}

export const REGISTER_COLUMNS: RegisterColumn[] = [
  { header: "Product Name", field: "product_name" },
  { header: "Manufacturer", field: "manufacturer" },
  { header: "Supplier", field: "supplier" },
  { header: "Hazardous (Y/N)", field: "is_hazardous" },
  { header: "DG Class", field: "dangerous_goods_class" },
  { header: "UN Number", field: "un_number" },
  { header: "SDS Issue Date", field: "issue_date" },
  { header: "Hazard Statements", field: "hazard_statements" },
  { header: "SDS Link", field: "pdf_url" },
  { header: "Reviewed By", field: "reviewed_by" },
  { header: "Date Added", field: "created_at" },
];
