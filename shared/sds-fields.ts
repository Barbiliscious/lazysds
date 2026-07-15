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

/**
 * Locked pictogram vocabulary (column 13). The nine GHS classes, plus
 * "None" (only if the SDS explicitly shows none) and "Not stated". A
 * pictogram is a picture, so text-only extraction leaves this "Not stated".
 */
export const PICTOGRAM_VOCAB = [
  "Explosive",
  "Flammable",
  "Oxidising",
  "Gas under pressure",
  "Corrosive",
  "Toxic",
  "Harmful/Irritant",
  "Health hazard",
  "Environmental hazard",
] as const;

/** "None" is valid only when the reviewer confirms the SDS explicitly shows none. */
export const PICTOGRAM_NONE = "None" as const;

/** The complete set of values the approval screen can save. */
export const PICTOGRAM_OPTIONS = [...PICTOGRAM_VOCAB, PICTOGRAM_NONE] as const;

export type PictogramOption = (typeof PICTOGRAM_OPTIONS)[number];

/** Converts a stored semicolon-separated value into safe controlled options. */
export function parsePictogramOptions(value: string | null): PictogramOption[] {
  if (!value) return [];
  const valid = new Set<string>(PICTOGRAM_OPTIONS);
  const options = value
    .split(";")
    .map((part) => part.trim())
    .filter((part): part is PictogramOption => valid.has(part));
  return [...new Set(options)];
}

/** Replaces typography dashes in app-generated values while source quotations stay verbatim. */
export function normaliseDisplayDashes(value: string): string {
  return value.replace(/[\u2013\u2014]/g, "-");
}

export interface FieldSpec {
  key: SDSFieldKey;
  /** 1-based column number in the register (matches the standard). */
  column: number;
  header: string;
  /** Short instruction shown to the model for this field. */
  guidance: string;
}

/** The 25 SDS-derived fields, in column order. */
export const FIELD_SPECS: FieldSpec[] = [
  { key: "product_name", column: 2, header: "Product Name", guidance: "Exact, as printed. Never a nickname." },
  { key: "manufacturer", column: 3, header: "Manufacturer", guidance: "The maker." },
  { key: "supplier_importer", column: 4, header: "Supplier / Importer", guidance: "Often a different company from the manufacturer." },
  { key: "product_codes", column: 5, header: "Product Codes", guidance: "Comma-separated if the SDS covers several." },
  { key: "issue_date", column: 7, header: "Issue Date", guidance: "Current SDS date. Use the most recent date labelled issue, issued, revised or revision. YYYY-MM-DD, or YYYY-MM if only month given, or YYYY. The print date is NOT the issue date. Never invent a day." },
  { key: "review_date_stated", column: 8, header: "Review Date", guidance: "ONLY if the SDS states a review-by date. If it doesn't, status NOT_STATED (the app calculates Issue Date + 5 years itself)." },
  { key: "hazardous_chemical", column: 10, header: "Hazardous Chemical?", guidance: "From Section 2 ONLY. value 'YES' or 'NO'. Describes the product AS SUPPLIED. Never 'NO' just because it isn't a Dangerous Good." },
  { key: "dangerous_goods", column: 11, header: "Dangerous Goods?", guidance: "From Section 14 ONLY. value 'YES', or status NOT_CLASSIFIED if the SDS says not a Dangerous Good. Independent of Hazardous Chemical." },
  { key: "signal_word", column: 12, header: "Signal Word", guidance: "value 'DANGER' or 'WARNING', or 'NONE' only if the SDS explicitly says none." },
  { key: "pictograms", column: 13, header: "Pictograms", guidance: "Locked vocabulary only, semicolon-separated: Explosive; Flammable; Oxidising; Gas under pressure; Corrosive; Toxic; Harmful/Irritant; Health hazard; Environmental hazard. Use None only if the SDS explicitly says or shows none. A pictogram is a picture - with text only you cannot see it reliably, so status NOT_STATED unless the SDS names the pictograms in words." },
  { key: "hazard_statements", column: 14, header: "Hazard Statements", guidance: "Code AND full text, hyphen between, semicolon-separated: 'H318 - Causes serious eye damage; H315 - Causes skin irritation'. Never the bare code, never the text alone. Keep H318 (eye damage) distinct from H319 (eye irritation)." },
  { key: "poisons_schedule", column: 15, header: "Poisons Schedule", guidance: "e.g. 'S6', or status NONE_ALLOCATED if the SDS says none allocated." },
  { key: "un_number", column: 16, header: "UN Number", guidance: "Only meaningful if Dangerous Goods is YES." },
  { key: "dg_class", column: 17, header: "DG Class / Subsidiary Risk", guidance: "Transport class and any subsidiary risk." },
  { key: "packing_group", column: 18, header: "Packing Group", guidance: "e.g. 'II'." },
  { key: "ppe_eyes_face", column: 19, header: "PPE - Eyes / Face", guidance: "Prefix value with status word: 'REQUIRED:', 'CONDITIONAL:', 'NORMALLY NOT REQUIRED', or 'NOT SPECIFIED'. Keep the exact condition. e.g. 'CONDITIONAL: Wear chemical splash goggles where splashing is possible.'" },
  { key: "ppe_hands", column: 20, header: "PPE - Hands", guidance: "Same status prefix. Keep the exact glove material (nitrile vs neoprene vs 'chemical-resistant') and any Australian Standard / breakthrough time." },
  { key: "ppe_respiratory", column: 21, header: "PPE - Respiratory", guidance: "Same status prefix. Keep the exact respirator and filter type (dust mask vs particulate vs organic vapour)." },
  { key: "ppe_body", column: 22, header: "PPE - Body", guidance: "Same status prefix." },
  { key: "first_aid", column: 23, header: "First Aid - Key Points", guidance: "Eyes / skin / inhaled / swallowed. Keep exact urgency and times verbatim: 'immediately', 'for at least 15 minutes', 'do not induce vomiting'. Never compress into 'seek advice'." },
  { key: "spill", column: 24, header: "Spill - Key Points", guidance: "Containment and clean-up method. Keep exact materials (e.g. 'absorb with inert material')." },
  { key: "storage", column: 25, header: "Storage - Key Points", guidance: "Temperature limits, container, sunlight - keep exact conditions." },
  { key: "incompatibilities", column: 26, header: "Incompatibilities", guidance: "Exact materials to keep it away from." },
  { key: "fire_media", column: 27, header: "Fire - Extinguishing Media", guidance: "Suitable AND unsuitable media." },
  { key: "dilution_condition", column: 28, header: "Dilution / Use Condition", guidance: "ONLY if the SDS states one. If a hazard depends on dilution/concentration, record the condition here (NOT in Hazardous Chemical). e.g. 'SDS states the product becomes non-hazardous when diluted 1 in 4.1 (24.4%) or more with water. Applies only to the correctly diluted solution.'" },
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

/** Pictograms use the agreed title-case wording instead of the generic status label. */
export function pictogramCellText(field: SDSField): string {
  if (field.status === "NOT_STATED") return "Not stated";
  return fieldCellText(field);
}
