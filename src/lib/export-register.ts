import { REGISTER_COLUMNS, type ColumnRef } from "@shared/config/register-columns";
import { CURRENCY_DISPLAY, EXTRACTION_STATUS_DISPLAY, fieldCellText } from "@shared/sds-fields";
import type { SDSIndexRecord } from "@shared/types";

/**
 * Turns register records into downloadable CSV / XLSX files. Both formats
 * are driven entirely by REGISTER_COLUMNS (shared/config/register-columns.ts)
 * — edit that file to change what gets exported, not this one.
 */

/** One cell's text for a given column, the same in CSV and XLSX. */
export function cellText(record: SDSIndexRecord, ref: ColumnRef): string {
  if ("field" in ref) {
    return fieldCellText(record.extracted[ref.field]);
  }
  switch (ref.record) {
    case "record_id":
      return record.record_id;
    case "sds_link":
      return record.pdf_url;
    case "review_date":
      return record.review_date ?? "";
    case "currency_flag":
      return CURRENCY_DISPLAY[record.currency_flag];
    case "extraction_status":
      return EXTRACTION_STATUS_DISPLAY[record.extracted.extraction_status];
    case "review_reasons":
      return record.extracted.review_reasons.join("; ");
    case "verified_by":
      return record.verified_by;
    case "verified_at":
      return record.verified_at.slice(0, 10);
  }
}

/** Quotes a value per RFC 4180 when it contains a comma, quote or newline. */
function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function registerToCsv(records: SDSIndexRecord[]): string {
  const rows = [
    REGISTER_COLUMNS.map((c) => csvEscape(c.header)).join(","),
    ...records.map((record) =>
      REGISTER_COLUMNS.map((c) => csvEscape(cellText(record, c.ref))).join(","),
    ),
  ];
  return rows.join("\r\n") + "\r\n";
}

function exportFilename(extension: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `sds-register-${today}.${extension}`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadRegisterCsv(records: SDSIndexRecord[]): void {
  // The BOM makes Excel detect UTF-8 instead of mangling accented characters.
  const blob = new Blob(["\uFEFF" + registerToCsv(records)], {
    type: "text/csv;charset=utf-8",
  });
  downloadBlob(blob, exportFilename("csv"));
}

export async function downloadRegisterXlsx(records: SDSIndexRecord[]): Promise<void> {
  // Lazy import: exceljs is large and only needed the moment someone exports.
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet("SDS Register");

  sheet.columns = REGISTER_COLUMNS.map((c) => ({
    header: c.header,
    width: Math.max(14, Math.min(50, c.header.length + 6)),
  }));
  sheet.getRow(1).font = { bold: true };
  for (const record of records) {
    sheet.addRow(REGISTER_COLUMNS.map((c) => cellText(record, c.ref)));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, exportFilename("xlsx"));
}
