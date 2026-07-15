import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ExtractedIndexRow, SDSField, SDSFieldKey } from "@shared/types";
import { EXTRACTION_STATUS_DISPLAY, STATUS_DISPLAY, fieldHeader } from "@shared/sds-fields";
import { CURRENCY_DISPLAY } from "@shared/sds-fields";
import { computeCurrencyFlag, resolveReviewDate } from "@shared/sds-dates";
import { getPendingReview, clearPendingReview } from "@/lib/pending-review";
import { saveReviewedRecord } from "@/lib/save-record";
import QuickReferenceNotice from "@/components/QuickReferenceNotice";

/**
 * Approval screen — nothing reaches the register without passing through
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

// Fields whose values are typically long — render as a textarea.
const LONG_FIELDS = new Set<SDSFieldKey>([
  "hazard_statements",
  "ppe_eyes_face",
  "ppe_hands",
  "ppe_respiratory",
  "ppe_body",
  "first_aid",
  "spill",
  "storage",
  "incompatibilities",
  "fire_media",
  "dilution_condition",
]);

const SECTIONS: { title: string; keys: SDSFieldKey[] }[] = [
  { title: "Identification", keys: ["product_name", "manufacturer", "supplier_importer", "product_codes"] },
  { title: "Dates", keys: ["issue_date", "review_date_stated"] },
  {
    title: "Hazard at a glance",
    keys: ["hazardous_chemical", "dangerous_goods", "signal_word", "pictograms", "hazard_statements", "poisons_schedule"],
  },
  { title: "Transport (Dangerous Goods)", keys: ["un_number", "dg_class", "packing_group"] },
  {
    title: "Quick response",
    keys: ["ppe_eyes_face", "ppe_hands", "ppe_respiratory", "ppe_body", "first_aid", "spill", "storage", "incompatibilities", "fire_media"],
  },
  { title: "Conditions", keys: ["dilution_condition"] },
];

export default function ReviewPage() {
  const navigate = useNavigate();
  // Captured once so clearing the store after save doesn't blank the page.
  const [pending] = useState(() => getPendingReview());
  const [fields, setFields] = useState<ExtractedIndexRow | null>(pending?.extracted ?? null);
  const [reviewedBy, setReviewedBy] = useState("");
  const [saveState, setSaveState] = useState<SaveState>({ phase: "editing" });

  // A refresh loses the in-memory hand-off — go back to the start.
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
    const { date } = resolveReviewDate(issue, statedReview);
    return { flag: computeCurrencyFlag(issue, date), reviewDate: date };
  }, [fields]);

  if (!pending || !fields) return null;

  const incomplete = fields.extraction_status === "INCOMPLETE_SOURCE";
  const canSave = reviewedBy.trim().length > 0 && !incomplete && saveState.phase !== "saving";

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
      <div className="mx-auto max-w-6xl p-4 lg:p-6">
        <header className="mb-4">
          <h1 className="text-2xl font-bold text-slate-800">Check the details</h1>
          <p className="text-slate-600">
            Each value below sits next to the exact sentence the AI read it from. <strong>Compare them against
            the PDF</strong> and fix anything wrong before you confirm.
          </p>
        </header>

        <QuickReferenceNotice className="mb-4" />

        <VerdictBanner status={EXTRACTION_STATUS_DISPLAY[fields.extraction_status]} reasons={fields.review_reasons} incomplete={incomplete} />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* PDF side */}
          <section aria-label="The source PDF" className="lg:sticky lg:top-4 self-start">
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
              {pdfUrl && <iframe title="Source safety data sheet" src={pdfUrl} className="w-full h-[50vh] lg:h-[80vh]" />}
            </div>
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-blue-600 underline">
                Open the PDF in a new tab
              </a>
            )}
            {currency && (
              <p className="mt-2 text-sm text-slate-600">
                Document currency: <strong>{CURRENCY_DISPLAY[currency.flag]}</strong>
                {currency.reviewDate && <> · review by {currency.reviewDate}</>}
              </p>
            )}
          </section>

          {/* Fields side */}
          <section aria-label="Extracted values" className="flex flex-col gap-6">
            {SECTIONS.map((sec) => (
              <div key={sec.title}>
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">{sec.title}</h2>
                <div className="flex flex-col gap-4">
                  {sec.keys.map((key) => (
                    <FieldRow
                      key={key}
                      fieldKey={key}
                      field={fields[key]}
                      original={pending.extracted[key]}
                      onChange={(text) => editField(key, text)}
                    />
                  ))}
                </div>
              </div>
            ))}

            <div className="rounded-lg bg-white border border-slate-200 p-4">
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
                <div role="alert" className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-red-800">
                  {saveState.message}
                </div>
              )}

              <button
                type="button"
                disabled={!canSave}
                onClick={() => void handleSave()}
                className="mt-4 w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
              >
                {saveState.phase === "saving" ? "Saving…" : "Looks right — add to register"}
              </button>
              <Link to="/" className="mt-3 block text-center text-slate-500 underline">Cancel and start again</Link>
            </div>
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
          The AI thinks pages are missing from this PDF. Don't save it — get a complete safety sheet and try again.
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
  const wrapClass = conflicting
    ? "rounded-lg bg-red-50 border border-red-300 p-3"
    : flagged
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
          rows={2}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
          value={field.value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          id={id}
          className="mt-1 w-full rounded-lg border border-slate-300 p-2"
          value={field.value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
      {(original.excerpt || original.location) && (
        <p className="mt-1 text-xs text-slate-500">
          {original.location && <span className="font-medium">{original.location}: </span>}
          {original.excerpt && <span className="italic">&ldquo;{original.excerpt}&rdquo;</span>}
        </p>
      )}
    </div>
  );
}
