import { REGISTER_COLUMNS } from "@shared/config/register-columns";
import type { SDSRecord } from "@shared/types";

/**
 * Turns register records into downloadable CSV / XLSX files. Both formats
 * are driven entirely by REGISTER_COLUMNS (shared/config/register-columns.ts)
 * — edit that file to change what gets exported, not this one.
 */

/** One cell's value as text, the same in both CSV and XLSX. */
export function formatCell(record: SDSRecord, field: keyof SDSRecord): string {
  const value = record[field];
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join("; ");
  if (field === "created_at") {
    // timestamptz from Postgres — keep just the unambiguous date part.
    return String(value).slice(0, 10);
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Quotes a value per RFC 4180 when it contains a comma, quote or newline. */
function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function registerToCsv(records: SDSRecord[]): string {
  const rows = [
    REGISTER_COLUMNS.map((c) => csvEscape(c.header)).join(","),
    ...records.map((record) =>
      REGISTER_COLUMNS.map((c) => csvEscape(formatCell(record, c.field))).join(","),
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

export function downloadRegisterCsv(records: SDSRecord[]): void {
  // The BOM makes Excel detect UTF-8 instead of mangling accented characters.
  const blob = new Blob(["\uFEFF" + registerToCsv(records)], {
    type: "text/csv;charset=utf-8",
  });
  downloadBlob(blob, exportFilename("csv"));
}

export async function downloadRegisterXlsx(records: SDSRecord[]): Promise<void> {
  // Lazy import: exceljs is large and only needed the moment someone exports.
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet("SDS Register");

  sheet.columns = REGISTER_COLUMNS.map((c) => ({
    header: c.header,
    width: Math.max(14, c.header.length + 4),
  }));
  sheet.getRow(1).font = { bold: true };
  for (const record of records) {
    sheet.addRow(REGISTER_COLUMNS.map((c) => formatCell(record, c.field)));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, exportFilename("xlsx"));
}
