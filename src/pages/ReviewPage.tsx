import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ExtractedIndexRow, SDSField, SDSFieldKey } from "@shared/types";
import {
  CURRENCY_DISPLAY,
  EXTRACTION_STATUS_DISPLAY,
  FIELD_SPECS,
  STATUS_DISPLAY,
  fieldHeader,
  normaliseDisplayDashes,
} from "@shared/sds-fields";
import { computeCurrencyFlag, parseSdsDate, resolveReviewDate } from "@shared/sds-dates";
import { getPendingReview, clearPendingReview } from "@/lib/pending-review";
import { saveReviewedRecord } from "@/lib/save-record";
import { sectionForField } from "@/lib/sds-sections";
import PdfSectionReview from "@/components/PdfSectionReview";
import QuickReferenceNotice from "@/components/QuickReferenceNotice";

/** Every field key, in the standard's column order. */
const FIELD_KEYS: SDSFieldKey[] = FIELD_SPECS.map((s) => s.key);

/**
 * Approval screen - nothing reaches the register without passing through
 * here. The AI's proposed value sits next to the exact SDS sentence it came
 * from, so the reviewer can verify at a glance. Every field is editable: if
 * the AI got it wrong, fix it before confirming. Requiring a source excerpt
 * for each value is what makes it hard for the model to invent one.
 */

type SaveState =
  | { phase: "editing" }
  | { phase: "saving" }
  | { phase: "saved" }
  | { phase: "error"; message: string };

// Fields whose values are typically long - render as a textarea.
const LONG_FIELDS = new Set<SDSFieldKey>([
  "hazard_statements",
  "ppe",
  "first_aid",
  "spill",
  "storage",
  "fire_media",
]);

// Generous textarea heights for the structured multi-line fields.
const FIELD_ROWS: Partial<Record<SDSFieldKey, number>> = {
  hazard_statements: 4,
  ppe: 6,
  first_aid: 5,
};

export default function ReviewPage() {
  const navigate = useNavigate();
  // Captured once so clearing the store after save doesn't blank the page.
  const [pending] = useState(() => getPendingReview());
  const [fields, setFields] = useState<ExtractedIndexRow | null>(pending?.extracted ?? null);
  const [reviewedBy, setReviewedBy] = useState("");
  const [saveState, setSaveState] = useState<SaveState>({ phase: "editing" });
  // Section numbers found in the PDF; null until it has been split.
  const [detectedSections, setDetectedSections] = useState<number[] | null>(null);
  const handleLoaded = useCallback(
    (info: { pageCount: number; sectionNumbers: number[] }) => setDetectedSections(info.sectionNumbers),
    [],
  );

  // A refresh loses the in-memory hand-off - go back to the start.
  useEffect(() => {
    if (!pending) navigate("/", { replace: true });
  }, [pending, navigate]);

  const pdfUrl = useMemo(() => (pending ? URL.createObjectURL(pending.file) : null), [pending]);
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  // Currency preview, computed the same deterministic way as at save time.
  const currency = useMemo(() => {
    if (!fields) return null;
    const issue = fields.issue_date.status === "STATED" ? fields.issue_date.value : null;
    const statedReview =
      fields.review_date_stated.status === "STATED" ? fields.review_date_stated.value : null;
    const { date, calculated } = resolveReviewDate(issue, statedReview);
    return { flag: computeCurrencyFlag(issue, date), reviewDate: date, calculated };
  }, [fields]);

  if (!pending || !fields) return null;

  const incomplete = fields.extraction_status === "INCOMPLETE_SOURCE";
  const issueDateValid = fields.issue_date.status !== "STATED" || parseSdsDate(fields.issue_date.value) !== null;
  const reviewDateValid = fields.review_date_stated.status !== "STATED"
    || parseSdsDate(fields.review_date_stated.value) !== null;
  const canSave = reviewedBy.trim().length > 0
    && !incomplete
    && issueDateValid
    && reviewDateValid
    && saveState.phase !== "saving";

  // Editing a field: text sets it STATED; clearing it reverts to NOT_STATED.
  const editField = (key: SDSFieldKey, text: string) =>
    setFields((f) => {
      if (!f) return f;
      const original: SDSField = pending.extracted[key];
      const next: SDSField =
        text.trim() === ""
          ? { value: null, status: original.status === "STATED" ? "NOT_STATED" : original.status, excerpt: original.excerpt, location: original.location }
          : { value: text, status: "STATED", excerpt: original.excerpt, location: original.location };
      return { ...f, [key]: next };
    });


  // The SDS section each field belongs to (its cited section, else canonical).
  const sectionOf = (key: SDSFieldKey): number => sectionForField(key, pending.extracted[key]);

  const renderReviewField = (key: SDSFieldKey) => {
    if (key === "review_date_stated" && currency) {
      return (
        <ReviewDateField
          field={fields.review_date_stated}
          resolvedDate={currency.reviewDate}
          calculated={currency.calculated}
          onChange={(text) => editField("review_date_stated", text)}
        />
      );
    }

    return (
      <FieldRow
        fieldKey={key}
        field={fields[key]}
        original={pending.extracted[key]}
        onChange={(text) => editField(key, text)}
      />
    );
  };

  // Fields for one SDS section, in column order. null if the section has none.
  const renderSectionFields = (sectionNumber: number) => {
    const keys = FIELD_KEYS.filter((key) => sectionOf(key) === sectionNumber);
    if (keys.length === 0) return null;
    return (
      <div className="flex flex-col gap-4">
        {keys.map((key) => <div key={key}>{renderReviewField(key)}</div>)}
      </div>
    );
  };

  // Fields whose section wasn't found as a heading in the PDF - shown at the
  // end so nothing is hidden, even when detection misses a section.
  const unmatchedKeys = detectedSections === null
    ? []
    : FIELD_KEYS.filter((key) => !detectedSections.includes(sectionOf(key)));

  async function handleSave() {
    if (!pending || !fields || !canSave) return;
    setSaveState({ phase: "saving" });
    try {
      await saveReviewedRecord(pending.file, fields, pending.source, reviewedBy.trim());
      clearPendingReview();
      setSaveState({ phase: "saved" });
    } catch (err) {
      setSaveState({
        phase: "error",
        message: err instanceof Error ? err.message : "Saving failed. Please try again.",
      });
    }
  }

  if (saveState.phase === "saved") {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-6 p-6 text-center">
        <span className="text-6xl" aria-hidden>✅</span>
        <h1 className="text-2xl font-bold text-slate-800">Added to the register</h1>
        <p className="text-slate-600 max-w-sm">
          {fields.product_name.value ?? "The product"} has been saved along with its safety sheet.
        </p>
        <Link to="/" className="rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white hover:bg-blue-700">
          Add another product
        </Link>
        <Link to="/register" className="text-blue-600 underline">See the full register</Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-[1500px] p-4 lg:p-6">
        <header className="mb-4">
          <h1 className="text-2xl font-bold text-slate-800">Check the details</h1>
          <p className="text-slate-600">
            The PDF is broken into its sections, with the AI's values for each section beside it. <strong>Compare
            every value against the matching section</strong> and fix anything wrong before you confirm.
          </p>
        </header>

        <QuickReferenceNotice className="mb-4" />

        <VerdictBanner status={EXTRACTION_STATUS_DISPLAY[fields.extraction_status]} reasons={fields.review_reasons} incomplete={incomplete} />

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-sm">
          {pdfUrl && (
            <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
              Open the PDF in a new tab
            </a>
          )}
          {currency && (
            <p className="text-slate-600">
              Document currency: <strong>{CURRENCY_DISPLAY[currency.flag]}</strong>
            </p>
          )}
        </div>

        <PdfSectionReview
          file={pending.file}
          onLoaded={handleLoaded}
          renderSectionFields={renderSectionFields}
        />

        {unmatchedKeys.length > 0 && (
          <div className="mt-10 grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <div className="hidden lg:block" aria-hidden />
            <section aria-label="Values not tied to a section" className="rounded-lg border border-amber-300 bg-amber-50 p-4">
              <h2 className="text-lg font-bold text-amber-900">Not tied to a section</h2>
              <p className="mb-4 text-sm text-amber-800">
                These values weren't matched to a section heading in the PDF. Check them against the document before saving.
              </p>
              <div className="flex flex-col gap-4">
                {unmatchedKeys.map((key) => <div key={key}>{renderReviewField(key)}</div>)}
              </div>
            </section>
          </div>
        )}

        <div className="mt-10 grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <div className="hidden lg:block" aria-hidden />
          <section aria-label="Confirm the reviewed record" className="rounded-lg border border-slate-200 bg-white p-4">
            <label className="block font-medium text-slate-700" htmlFor="reviewed-by">
              Your name or initials <span className="text-red-600">*</span>
            </label>
            <p className="text-sm text-slate-500">Recorded as the person who checked and confirmed this entry.</p>
            <input
              id="reviewed-by"
              className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-lg"
              value={reviewedBy}
              onChange={(e) => setReviewedBy(e.target.value)}
              placeholder="e.g. AM"
            />

            {saveState.phase === "error" && (
              <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800">
                {saveState.message}
              </div>
            )}

            <button
              type="button"
              disabled={!canSave}
              onClick={() => void handleSave()}
              className="mt-4 w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
            >
              {saveState.phase === "saving" ? "Saving..." : "Looks right - add to register"}
            </button>
            <Link to="/" className="mt-3 block text-center text-slate-500 underline">Cancel and start again</Link>
          </section>
        </div>
      </div>
    </main>
  );
}

function VerdictBanner({ status, reasons, incomplete }: { status: string; reasons: string[]; incomplete: boolean }) {
  const tone = incomplete
    ? "bg-red-50 border-red-300 text-red-900"
    : reasons.length > 0
      ? "bg-amber-50 border-amber-300 text-amber-900"
      : "bg-green-50 border-green-300 text-green-900";
  return (
    <div role="status" className={`mb-4 rounded-lg border px-4 py-3 ${tone}`}>
      <p className="font-semibold">AI verdict: {status}</p>
      {incomplete && (
        <p className="mt-1 text-sm">
          The AI thinks pages are missing from this PDF. Don't save it - get a complete safety sheet and try again.
        </p>
      )}
      {reasons.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-sm">
          {reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FieldRow({
  fieldKey,
  field,
  original,
  onChange,
}: {
  fieldKey: SDSFieldKey;
  field: SDSField;
  original: SDSField;
  onChange: (text: string) => void;
}) {
  const id = `field-${fieldKey}`;
  const flagged = original.status !== "STATED";
  const conflicting = original.status === "CONFLICTING";
  const invalidDate = fieldKey === "issue_date"
    && field.status === "STATED"
    && parseSdsDate(field.value) === null;
  const wrapClass = conflicting
    ? "rounded-lg bg-red-50 border border-red-300 p-3"
    : flagged || invalidDate
      ? "rounded-lg bg-amber-50 border border-amber-300 p-3"
      : "";
  const placeholder = original.status === "STATED" ? "Not stated on the sheet" : STATUS_DISPLAY[original.status];

  return (
    <div className={wrapClass}>
      <label className="block font-medium text-slate-700" htmlFor={id}>
        {fieldHeader(fieldKey)}
        {flagged && (
          <span
            className={`ml-2 rounded px-2 py-0.5 text-xs font-semibold align-middle ${
              conflicting ? "bg-red-200 text-red-900" : "bg-amber-200 text-amber-900"
            }`}
          >
            {STATUS_DISPLAY[original.status]}
          </span>
        )}
      </label>
      {LONG_FIELDS.has(fieldKey) ? (
        <textarea
          id={id}
          rows={FIELD_ROWS[fieldKey] ?? 2}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
          value={normaliseDisplayDashes(field.value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          id={id}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2"
          value={normaliseDisplayDashes(field.value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
      {invalidDate && (
        <p className="mt-1 text-xs text-amber-800">Use YYYY-MM-DD, YYYY-MM or YYYY.</p>
      )}
    </div>
  );
}

function ReviewDateField({
  field,
  resolvedDate,
  calculated,
  onChange,
}: {
  field: SDSField;
  resolvedDate: string | null;
  calculated: boolean;
  onChange: (text: string) => void;
}) {
  const fromSds = field.status === "STATED";
  const displayValue = fromSds ? field.value ?? "" : resolvedDate ?? "";
  const valid = !fromSds || parseSdsDate(field.value) !== null;

  return (
    <div className={!valid || !displayValue ? "rounded-lg bg-amber-50 border border-amber-300 p-3" : ""}>
      <label className="block font-medium text-slate-700" htmlFor="field-review-date">
        Review Date
      </label>
      <input
        id="field-review-date"
        className="mt-1 w-full rounded-lg border border-slate-300 p-2"
        value={normaliseDisplayDashes(displayValue)}
        onChange={(event) => onChange(event.target.value)}
        placeholder="YYYY-MM-DD, YYYY-MM or YYYY"
      />
      <p className={`mt-1 text-xs ${valid ? "text-slate-500" : "text-amber-800"}`}>
        {!valid
          ? "Use YYYY-MM-DD, YYYY-MM or YYYY."
          : fromSds
            ? "From SDS"
            : calculated
              ? "Calculated from Issue Date"
              : "Not available - check Issue Date"}
      </p>
    </div>
  );
}

