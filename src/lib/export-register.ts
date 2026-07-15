import {
  REGISTER_COLUMNS,
  QUICK_REFERENCE_BANNER,
  type ColumnRef,
} from "@shared/config/register-columns";
import {
  CURRENCY_DISPLAY,
  EXTRACTION_STATUS_DISPLAY,
  fieldCellText,
  normaliseDisplayDashes,
  pictogramCellText,
} from "@shared/sds-fields";
import type { SDSField, SDSIndexRecord } from "@shared/types";

/**
 * Turns register records into downloadable CSV / XLSX files. The columns,
 * order, and group bands are driven by REGISTER_COLUMNS
 * (shared/config/register-columns.ts) - edit that file, not this one. The
 * XLSX matches the Grampians example workbook: a banner row, navy group
 * bands, merged Manufacturer/Supplier and PPE columns, and a hyperlinked
 * SDS Link. CSV is the same columns, flat.
 */

const PPE_SUBFIELDS: [keyof SDSIndexRecord["extracted"], string][] = [
  ["ppe_eyes_face", "Eyes / Face"],
  ["ppe_hands", "Hands"],
  ["ppe_respiratory", "Respiratory"],
  ["ppe_body", "Body"],
];

/** The present PPE sub-fields as {label, text} lines (empty if none stated). */
function ppeLines(record: SDSIndexRecord): { label: string; text: string }[] {
  return PPE_SUBFIELDS.flatMap(([key, label]) => {
    const field = record.extracted[key] as SDSField;
    return field.status === "NOT_STATED" ? [] : [{ label, text: fieldCellText(field) }];
  });
}

/** The combined "Manufacturer / Supplier / Importer" text. */
function manufacturerSupplier(record: SDSIndexRecord): string {
  const parts = [record.extracted.manufacturer.value, record.extracted.supplier_importer.value].filter(
    (v): v is string => Boolean(v),
  );
  const unique = [...new Set(parts)];
  return unique.length > 0
    ? normaliseDisplayDashes(unique.join(" / "))
    : fieldCellText(record.extracted.manufacturer);
}

/** One cell's plain text for a given column - used by CSV and as a fallback. */
export function cellText(record: SDSIndexRecord, ref: ColumnRef): string {
  if ("field" in ref) {
    return ref.field === "pictograms"
      ? pictogramCellText(record.extracted.pictograms)
      : fieldCellText(record.extracted[ref.field]);
  }
  if ("combined" in ref) {
    if (ref.combined === "manufacturer_supplier") return manufacturerSupplier(record);
    const lines = ppeLines(record);
    return lines.length > 0 ? lines.map((l) => `${l.label} - ${l.text}`).join("\n") : "NOT STATED";
  }
  switch (ref.record) {
    case "record_id":
      return record.record_id;
    case "sds_link":
      return record.pdf_url;
    case "review_date":
      return record.review_date ?? "";
    case "extraction_status":
      return EXTRACTION_STATUS_DISPLAY[record.extracted.extraction_status];
    case "review_reasons":
      return normaliseDisplayDashes(record.extracted.review_reasons.join("; "));
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

// ── XLSX (styled, matches the example workbook) ─────────────────────────────

const ARIAL = { name: "Arial", size: 10 } as const;
const NAVY = "FF1F3864";
const WHITE = "FFFFFFFF";
const BANNER_FILL = "FFFFF2CC";
const BANNER_TEXT = "FF7A2B2B";
const LINK_BLUE = "FF0563C1";

// Column widths from the example workbook, in column order.
const WIDTHS = [22, 30, 22, 13, 14, 13, 13, 14, 20, 46, 34, 46, 34, 32, 30, 20, 38, 13, 13, 26];

type WorksheetLike = Awaited<ReturnType<typeof buildWorkbook>>["ws"];

async function buildWorkbook(records: SDSIndexRecord[]) {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  const ws = workbook.addWorksheet("SDS Index");
  const cols = REGISTER_COLUMNS;
  const n = cols.length;

  cols.forEach((_, i) => (ws.getColumn(i + 1).width = WIDTHS[i] ?? 20));

  // Row 1 - the mandatory notice, merged across every column.
  ws.mergeCells(1, 1, 1, n);
  const banner = ws.getCell(1, 1);
  banner.value = QUICK_REFERENCE_BANNER;
  banner.font = { ...ARIAL, bold: true, color: { argb: BANNER_TEXT } };
  banner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BANNER_FILL } };
  banner.alignment = { wrapText: true, vertical: "middle" };
  ws.getRow(1).height = 42;

  // Row 2 - group bands (merge each run of the same non-empty group label).
  for (let i = 0; i < n; ) {
    const group = cols[i]!.group;
    let j = i;
    while (j + 1 < n && cols[j + 1]!.group === group && group !== "") j++;
    if (group !== "") {
      if (j > i) ws.mergeCells(2, i + 1, 2, j + 1);
      const cell = ws.getCell(2, i + 1);
      cell.value = group;
      cell.font = { ...ARIAL, bold: true, color: { argb: WHITE } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    }
    i = j + 1;
  }

  // Row 3 - column headers.
  cols.forEach((c, i) => {
    const cell = ws.getCell(3, i + 1);
    cell.value = c.header;
    cell.font = { ...ARIAL, bold: true, color: { argb: WHITE } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  });

  // Data rows.
  records.forEach((record, r) => {
    const rowNum = 4 + r;
    cols.forEach((c, i) => {
      const cell = ws.getCell(rowNum, i + 1);
      cell.font = { ...ARIAL };
      cell.alignment = { wrapText: true, vertical: "top" };

      if ("record" in c.ref && c.ref.record === "sds_link") {
        cell.value = { text: record.pdf_url, hyperlink: record.pdf_url };
        cell.font = { ...ARIAL, underline: true, color: { argb: LINK_BLUE } };
      } else if ("combined" in c.ref && c.ref.combined === "ppe") {
        const lines = ppeLines(record);
        if (lines.length === 0) {
          cell.value = "NOT STATED";
        } else {
          cell.value = {
            richText: lines.flatMap((l, idx) => [
              { font: { ...ARIAL, bold: true }, text: l.label },
              { font: { ...ARIAL }, text: ` - ${l.text}${idx < lines.length - 1 ? "\n" : ""}` },
            ]),
          };
        }
      } else {
        cell.value = cellText(record, c.ref);
      }
    });
  });

  // Freeze the first two columns and the three header rows.
  ws.views = [{ state: "frozen", xSplit: 2, ySplit: 3 }];

  return { workbook, ws };
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

export type { WorksheetLike };
