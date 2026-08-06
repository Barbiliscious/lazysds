import {
  REGISTER_COLUMNS,
  QUICK_REFERENCE_BANNER,
  type ColumnRef,
  type RegisterColumn,
} from "@shared/config/register-columns";
import { CURRENCY_DISPLAY, fieldCellText } from "@shared/sds-fields";
import { sdsFilename } from "@shared/sds-id";
import type { SDSIndexRecord } from "@shared/types";
import { buildSharePointLink } from "./sharepoint";

/**
 * Turns register records into downloadable CSV / XLSX files. The columns,
 * order, and group bands are driven by REGISTER_COLUMNS
 * (shared/config/register-columns.ts) - edit that file, not this one.
 *
 * The XLSX has two sheets: "Paste" is machine-clean and paste-ready for a
 * SharePoint list's grid view (one header row, sanitised plain-text cells,
 * no formatting/merges/hyperlinks/frozen panes - any of those breaks a grid
 * paste). "Read Me" carries the disclaimer and the column/section
 * documentation that used to live in the Paste sheet's banner and group
 * bands. CSV is the same columns, flat, unaffected by the paste-safety
 * rules (a CSV cell can hold a real line break without corrupting the file).
 */

/** One cell's plain text for a given column - used by CSV and the Paste sheet. */
export function cellText(record: SDSIndexRecord, ref: ColumnRef): string {
  if ("field" in ref) return fieldCellText(record.extracted[ref.field]);
  switch (ref.record) {
    case "record_id":
      return record.record_id;
    case "sds_filename":
      return sdsFilename(record.filename_stem, record.record_id);
    case "sds_link":
      return buildSharePointLink(`${sdsFilename(record.filename_stem, record.record_id)}.pdf`) ?? "";
    case "review_date":
      return record.review_date ?? "";
    case "verified_by":
      return record.verified_by;
    case "verified_at":
      return record.verified_at.slice(0, 10);
  }
}

/** Currency isn't a column in this layout; expose it for callers that want it. */
export function currencyText(record: SDSIndexRecord): string {
  return CURRENCY_DISPLAY[record.currency_flag];
}

const MAX_CELL_LENGTH = 30000;
const LITERAL_EMPTY_VALUES = new Set(["none", "null", "nan", "undefined"]);

/**
 * Makes a cell safe to paste into a SharePoint list's grid view. A line
 * break inside a pasted cell ends the paste early and shifts every
 * following row, so every line break / tab / carriage return becomes "; "
 * instead. Also collapses repeated spaces, trims, normalises a bare
 * yes/no to YES/NO, caps length, and guards against the literal strings
 * "None" / "null" / "NaN" (a bug elsewhere stringifying a missing value) -
 * those become a genuinely empty cell, same as any other empty value.
 */
export function sanitizePasteCell(raw: string): string {
  let value = raw.replace(/[\r\n\t]+/g, "; ");
  value = value.replace(/ {2,}/g, " ").trim();
  value = value.replace(/^(; )+/, "").replace(/(; )+$/, "");
  if (LITERAL_EMPTY_VALUES.has(value.toLowerCase())) return "";
  if (/^(yes|no)$/i.test(value)) value = value.toUpperCase();
  return value.length > MAX_CELL_LENGTH ? value.slice(0, MAX_CELL_LENGTH) : value;
}

// ── CSV ───────────────────────────────────────────────────────────────────

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

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadRegisterCsv(records: SDSIndexRecord[]): void {
  // The BOM makes Excel detect UTF-8 instead of mangling accented characters.
  const BOM = String.fromCharCode(0xfeff);
  const blob = new Blob([BOM + registerToCsv(records)], {
    type: "text/csv;charset=utf-8",
  });
  downloadBlob(blob, exportFilename("csv"));
}

// ── XLSX (Paste + Read Me) ──────────────────────────────────────────────────

const ARIAL = { name: "Arial", size: 10 } as const;

/** Sheet 1: exactly a header row plus sanitised plain-text data rows - no
 * banner, no group rows, no merges, no formatting, no frozen panes, so it
 * pastes cleanly into a SharePoint list's grid view. */
function buildPasteSheet(workbook: import("exceljs").Workbook, records: SDSIndexRecord[]) {
  const paste = workbook.addWorksheet("Paste");
  const cols = REGISTER_COLUMNS;

  cols.forEach((c, i) => {
    paste.getCell(1, i + 1).value = c.header;
  });

  records.forEach((record, r) => {
    const rowNum = 2 + r;
    cols.forEach((c, i) => {
      const text = sanitizePasteCell(cellText(record, c.ref));
      if (text !== "") paste.getCell(rowNum, i + 1).value = text;
    });
  });

  return paste;
}

/** Sheet 2: the disclaimer and column documentation moved out of the Paste
 * sheet's old banner/group-band rows - for humans, not for pasting. */
function buildReadMeSheet(workbook: import("exceljs").Workbook, cols: RegisterColumn[]) {
  const readMe = workbook.addWorksheet("Read Me");
  readMe.getColumn(1).width = 34;
  readMe.getColumn(2).width = 30;

  const title = readMe.getCell(1, 1);
  title.value = "LazySDS Register Export";
  title.font = { ...ARIAL, bold: true, size: 14 };

  const disclaimer = readMe.getCell(3, 1);
  disclaimer.value = QUICK_REFERENCE_BANNER;
  disclaimer.alignment = { wrapText: true, vertical: "top" };
  readMe.mergeCells(3, 1, 3, 2);
  readMe.getRow(3).height = 45;

  const note = readMe.getCell(5, 1);
  note.value =
    "The Paste sheet is machine-clean for pasting straight into a SharePoint list's grid view: one header row, "
    + "plain text only, no formatting. The columns below are grouped by SDS section for reference.";
  note.alignment = { wrapText: true, vertical: "top" };
  readMe.mergeCells(5, 1, 5, 2);
  readMe.getRow(5).height = 30;

  const headerRow = 7;
  readMe.getCell(headerRow, 1).value = "Column";
  readMe.getCell(headerRow, 2).value = "SDS Section";
  readMe.getRow(headerRow).font = { ...ARIAL, bold: true };

  cols.forEach((c, i) => {
    const rowNum = headerRow + 1 + i;
    readMe.getCell(rowNum, 1).value = c.header;
    readMe.getCell(rowNum, 2).value = c.group || "-";
  });

  return readMe;
}

async function buildWorkbook(records: SDSIndexRecord[]) {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  const paste = buildPasteSheet(workbook, records);
  buildReadMeSheet(workbook, REGISTER_COLUMNS);
  return { workbook, paste };
}

export async function downloadRegisterXlsx(records: SDSIndexRecord[]): Promise<void> {
  const { workbook } = await buildWorkbook(records);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, exportFilename("xlsx"));
}

// Exported for tests: build the workbook without triggering a download.
export async function buildRegisterWorkbook(records: SDSIndexRecord[]) {
  return (await buildWorkbook(records)).workbook;
}
