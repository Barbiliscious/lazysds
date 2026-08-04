import type {
  CurrencyFlag,
  ExtractionStatus,
  FieldStatus,
  SDSField,
  SDSFieldKey,
} from "./types";

/**
 * The field vocabulary shared by the extraction prompt, the approval screen,
 * and the export. Edit headers/guidance here and every surface follows.
 */

/** Human-readable form of each controlled status (see the standard). */
export const STATUS_DISPLAY: Record<FieldStatus, string> = {
  STATED: "STATED",
  NOT_STATED: "NOT STATED",
  NOT_AVAILABLE: "NOT AVAILABLE",
  NOT_APPLICABLE: "NOT APPLICABLE",
  NONE_ALLOCATED: "NONE ALLOCATED",
  NOT_CLASSIFIED: "NOT CLASSIFIED",
  UNREADABLE: "UNREADABLE",
  CONFLICTING: "CONFLICTING",
  NA_UNCLEAR: "N/A - MEANING UNCLEAR - MANUAL REVIEW REQUIRED",
};

export const EXTRACTION_STATUS_DISPLAY: Record<ExtractionStatus, string> = {
  READY_FOR_HUMAN_REVIEW: "READY FOR HUMAN REVIEW",
  MANUAL_REVIEW_REQUIRED: "MANUAL REVIEW REQUIRED",
  INCOMPLETE_SOURCE: "INCOMPLETE SOURCE",
};

export const CURRENCY_DISPLAY: Record<CurrencyFlag, string> = {
  CURRENT: "CURRENT",
  POSSIBLY_OUTDATED: "POSSIBLY OUTDATED - OBTAIN CURRENT SDS",
  DATE_UNCONFIRMED: "DATE UNCONFIRMED",
};

/** Replaces typography dashes in app-generated values while source quotations stay verbatim. */
export function normaliseDisplayDashes(value: string): string {
  return value.replace(/[\u2013\u2014]/g, "-");
}

export interface FieldSpec {
  key: SDSFieldKey;
  header: string;
  /** Instruction shown to the model for this field. */
  guidance: string;
  /** Verbatim fact vs plain-language summary. */
  kind: "fact" | "summary";
}

/**
 * The 15 SDS-derived fields, in display order.
 *  - "fact" fields are copied word-for-word from the SDS.
 *  - "summary" fields are plain-language AI summaries \u2014 numbers, times,
 *    units, materials and conditions kept exact, urgency never softened.
 */
export const FIELD_SPECS: FieldSpec[] = [
  { key: "product_name", header: "Product Name", kind: "fact", guidance: "Exact, as printed. Never a nickname." },
  { key: "manufacturer_supplier_importer", header: "Manufacturer / Supplier / Importer", kind: "fact", guidance: "From Section 1. Return one organisation only: whichever manufacturer, supplier or importer appears first in the document's reading order. Do not combine organisation names." },
  { key: "product_codes", header: "Product Codes", kind: "fact", guidance: "Comma-separated if the SDS covers several." },
  { key: "issue_date", header: "Issue Date", kind: "fact", guidance: "Current SDS date. Use the most recent date labelled issue, issued, revised or revision. YYYY-MM-DD, or YYYY-MM if only month given, or YYYY. The print date is NOT the issue date. Never invent a day." },
  { key: "review_date_stated", header: "Review Date", kind: "fact", guidance: "ONLY if the SDS states a review-by date. If it doesn't, status NOT_STATED (the app calculates Issue Date + 5 years itself). A statement like 'valid for 5 years from issue' is NOT a stated date - leave NOT_STATED." },
  { key: "hazardous_chemical", header: "Hazardous Chemical?", kind: "fact", guidance: "From Section 2 ONLY. value 'YES' or 'NO'. Describes the product AS SUPPLIED - if the SDS says it becomes non-hazardous when diluted, it is still YES. Never 'NO' just because it isn't a Dangerous Good." },
  { key: "dangerous_goods", header: "Dangerous Goods?", kind: "fact", guidance: "The SDS's own Dangerous Goods / Transport classification, wherever it states it (commonly Section 14 Transport Information, sometimes repeated in Section 2). value 'YES', or status NOT_CLASSIFIED if the SDS says not a Dangerous Good. Independent of Hazardous Chemical." },
  { key: "signal_word", header: "Signal Word", kind: "fact", guidance: "value 'DANGER' or 'WARNING', or 'NONE' only if the SDS explicitly says none." },
  { key: "hazard_classification", header: "Hazard Classification", kind: "fact", guidance: "From Section 2. The GHS hazard classification categories exactly as listed, ONE PER LINE (newline-separated), e.g.:\nEye Irritation - Category 2A\nSkin Sensitisation - Category 1\nNot the same as Hazard Statements (the H-codes) below - this is the classification/category line." },
  { key: "hazard_statements", header: "Hazard Statements", kind: "fact", guidance: "Code AND full text, hyphen between, ONE PER LINE (newline-separated):\nH318 - Causes serious eye damage\nH315 - Causes skin irritation\nNever the bare code, never the text alone. Keep H318 (eye damage) distinct from H319 (eye irritation)." },
  { key: "ppe", header: "PPE", kind: "summary", guidance: "ONE field for all protective equipment, grouped by requirement level. Group headers 'REQUIRED:' / 'CONDITIONAL:' each on their own line, then one line per area, label then hyphen:\nREQUIRED:\nEyes / Face - Protective glasses or goggles should be worn when this product is being used.\nHands - Chemical-resistant gloves (nitrile).\nCONDITIONAL:\nRespiratory - If dusts are likely to build up, use a suitable mask.\nAreas: Eyes / Face, Hands, Respiratory, Body. Only include areas the SDS covers. Summarise in plain language but keep the exact glove material, respirator/filter type, Australian Standard, and any condition." },
  { key: "first_aid", header: "First Aid - Key Points", kind: "summary", guidance: "One line per exposure event, label then hyphen:\nInhalation - Move to fresh air; seek medical attention if symptoms persist.\nSkin Contact - Wash with soap and water.\nEyes - Rinse immediately with water for at least 15 minutes; seek urgent medical attention.\nSwallowed - Do not induce vomiting; call the Poisons Information Centre 13 11 26.\nSummarise in plain language but keep exact urgency and times verbatim ('immediately', 'for at least 15 minutes', 'do not induce vomiting'). Never compress an urgent instruction into 'seek advice'." },
  { key: "spill", header: "Spill - Key Points", kind: "summary", guidance: "Short plain-language summary of containment and clean-up. Keep exact materials and drain/waterway warnings." },
  { key: "storage", header: "Storage - Key Points", kind: "summary", guidance: "SHORT plain-language summary. Keep exact temperature limits and container conditions." },
  { key: "fire_media", header: "Fire - Extinguishing Media", kind: "summary", guidance: "Suitable (and unsuitable, if stated) media, briefly." },
];

const FIELD_SPEC_BY_KEY: Record<SDSFieldKey, FieldSpec> = Object.fromEntries(
  FIELD_SPECS.map((s) => [s.key, s]),
) as Record<SDSFieldKey, FieldSpec>;

export function fieldHeader(key: SDSFieldKey): string {
  return FIELD_SPEC_BY_KEY[key].header;
}

/**
 * The text to show for a field: its value when stated, otherwise the
 * human-readable status. Never blank - a blank cell is a bug; a status isn't.
 */
export function fieldCellText(field: SDSField): string {
  if (field.status === "STATED" && field.value) return normaliseDisplayDashes(field.value);
  return STATUS_DISPLAY[field.status];
}

