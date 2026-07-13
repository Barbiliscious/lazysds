import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Confidence, ExtractedSDS } from "@shared/types";
import { getPendingReview, clearPendingReview } from "@/lib/pending-review";
import { saveReviewedRecord } from "@/lib/save-record";

/**
 * Human review screen — nothing reaches the register without passing
 * through here. Product name and manufacturer are rendered extra large
 * because the realistic failure mode is the WRONG VARIANT of a product
 * ("Mortein Outdoor" vs "Mortein Naturgard"), and that must be obvious
 * at a glance next to the PDF.
 */

type SaveState = { phase: "editing" } | { phase: "saving" } | { phase: "saved" } | { phase: "error"; message: string };

export default function ReviewPage() {
  const navigate = useNavigate();
  // Captured once: clearing the module store after a successful save must
  // not blank this page out — the success screen still needs the data.
  const [pending] = useState(() => getPendingReview());

  const [fields, setFields] = useState<ExtractedSDS | null>(pending?.extracted ?? null);
  const [hazardStatementsText, setHazardStatementsText] = useState(
    pending?.extracted.hazard_statements.join("\n") ?? "",
  );
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

  if (!pending || !fields) return null;

  const set = <K extends keyof ExtractedSDS>(key: K, value: ExtractedSDS[K]) =>
    setFields((f) => (f ? { ...f, [key]: value } : f));

  const canSave = reviewedBy.trim().length > 0 && saveState.phase !== "saving";

  async function handleSave() {
    if (!pending || !fields || !canSave) return;
    setSaveState({ phase: "saving" });
    try {
      await saveReviewedRecord(pending.file, {
        ...fields,
        hazard_statements: hazardStatementsText
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        source: "upload",
        reviewed_by: reviewedBy.trim(),
      });
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
        <span className="text-6xl" aria-hidden>
          ✅
        </span>
        <h1 className="text-2xl font-bold text-slate-800">Added to the register</h1>
        <p className="text-slate-600 max-w-sm">
          {fields.product_name ?? "The product"} has been saved along with its safety sheet.
        </p>
        <Link
          to="/"
          className="rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white hover:bg-blue-700"
        >
          Add another product
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl p-4 lg:p-6">
        <header className="mb-4">
          <h1 className="text-2xl font-bold text-slate-800">Check the details</h1>
          <p className="text-slate-600">
            We read these from the PDF — <strong>compare them against the document</strong> and fix anything
            that's wrong before saving. Fields we weren't sure about are{" "}
            <mark className="bg-amber-200 px-1 rounded">highlighted</mark>.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* PDF side */}
          <section aria-label="The uploaded PDF" className="lg:sticky lg:top-4 self-start">
            <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
              {pdfUrl && (
                <iframe title="Uploaded safety data sheet" src={pdfUrl} className="w-full h-[50vh] lg:h-[80vh]" />
              )}
            </div>
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-blue-600 underline">
                Open the PDF in a new tab
              </a>
            )}
          </section>

          {/* Fields side */}
          <section aria-label="Extracted details" className="flex flex-col gap-4">
            <TextField
              label="Product name"
              hint="Check the exact variant — e.g. 'Outdoor' vs 'Indoor'"
              prominent
              confidence={fields.confidence.product_name}
              value={fields.product_name ?? ""}
              onChange={(v) => set("product_name", v === "" ? null : v)}
            />
            <TextField
              label="Manufacturer"
              prominent
              confidence={fields.confidence.manufacturer}
              value={fields.manufacturer ?? ""}
              onChange={(v) => set("manufacturer", v === "" ? null : v)}
            />
            <TextField
              label="Supplier"
              value={fields.supplier ?? ""}
              onChange={(v) => set("supplier", v === "" ? null : v)}
            />

            <div className={fieldWrapClass(fields.confidence.is_hazardous)}>
              <label className="block font-medium text-slate-700" htmlFor="is-hazardous">
                Is it classified as hazardous?
                {fields.confidence.is_hazardous === "low" && <LowConfidenceBadge />}
              </label>
              <select
                id="is-hazardous"
                className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-lg bg-white"
                value={fields.is_hazardous === null ? "unknown" : String(fields.is_hazardous)}
                onChange={(e) =>
                  set("is_hazardous", e.target.value === "unknown" ? null : e.target.value === "true")
                }
              >
                <option value="true">Yes — the sheet says it's hazardous</option>
                <option value="false">No — the sheet says it's not hazardous</option>
                <option value="unknown">The sheet doesn't clearly say</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <TextField
                label="Dangerous goods class"
                value={fields.dangerous_goods_class ?? ""}
                onChange={(v) => set("dangerous_goods_class", v === "" ? null : v)}
              />
              <TextField
                label="UN number"
                value={fields.un_number ?? ""}
                onChange={(v) => set("un_number", v === "" ? null : v)}
              />
            </div>

            <TextField
              label="Date on the safety sheet"
              hint="As printed on the document"
              value={fields.issue_date ?? ""}
              onChange={(v) => set("issue_date", v === "" ? null : v)}
            />

            <div>
              <label className="block font-medium text-slate-700" htmlFor="hazard-statements">
                Hazard statements <span className="font-normal text-slate-500">(one per line)</span>
              </label>
              <textarea
                id="hazard-statements"
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-mono text-sm"
                value={hazardStatementsText}
                onChange={(e) => setHazardStatementsText(e.target.value)}
                placeholder="e.g. H222 Extremely flammable aerosol."
              />
            </div>

            <div className="rounded-lg bg-white border border-slate-200 p-4 mt-2">
              <label className="block font-medium text-slate-700" htmlFor="reviewed-by">
                Your name or initials <span className="text-red-600">*</span>
              </label>
              <p className="text-sm text-slate-500">Recorded as the person who checked this entry.</p>
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
              <Link to="/" className="mt-3 block text-center text-slate-500 underline">
                Cancel and start again
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function fieldWrapClass(confidence?: Confidence): string {
  return confidence === "low" ? "rounded-lg bg-amber-50 border border-amber-300 p-3" : "";
}

function LowConfidenceBadge() {
  return (
    <span className="ml-2 rounded bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900 align-middle">
      please double-check
    </span>
  );
}

function TextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  prominent?: boolean;
  confidence?: Confidence;
}) {
  const id = props.label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className={fieldWrapClass(props.confidence)}>
      <label className="block font-medium text-slate-700" htmlFor={id}>
        {props.label}
        {props.confidence === "low" && <LowConfidenceBadge />}
      </label>
      {props.hint && <p className="text-sm text-slate-500">{props.hint}</p>}
      <input
        id={id}
        className={`mt-1 w-full rounded-lg border border-slate-300 p-3 ${
          props.prominent ? "text-xl font-semibold" : "text-base"
        }`}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder="Not stated on the sheet"
      />
    </div>
  );
}
