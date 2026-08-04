import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { ExtractedIndexRow, SDSField, SDSFieldKey, SDSIndexRecord } from "@shared/types";
import { FIELD_SPECS, fieldHeader, normaliseDisplayDashes } from "@shared/sds-fields";
import { parseSdsDate } from "@shared/sds-dates";
import { fetchRecordById, updateRecord } from "@/lib/register";

/**
 * Edit a saved register entry. A plain field editor (the source PDF can't be
 * changed here - open it via the link). Clearing a field marks it NOT_STATED;
 * typing a value marks it STATED. Dates are re-validated, and the record id /
 * review date / currency are recomputed on save.
 */

const FIELD_KEYS: SDSFieldKey[] = FIELD_SPECS.map((s) => s.key);
const LONG_FIELDS = new Set<SDSFieldKey>([
  "hazard_classification",
  "hazard_statements",
  "ppe",
  "first_aid",
  "spill",
  "storage",
  "fire_media",
]);
const FIELD_ROWS: Partial<Record<SDSFieldKey, number>> = {
  hazard_classification: 2,
  hazard_statements: 4,
  ppe: 6,
  first_aid: 5,
};
const DATE_FIELDS = new Set<SDSFieldKey>(["issue_date", "review_date_stated"]);

type State =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "loaded"; record: SDSIndexRecord };

type Save = { phase: "editing" } | { phase: "saving" } | { phase: "error"; message: string };

export default function EditRecordPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ phase: "loading" });
  const [fields, setFields] = useState<ExtractedIndexRow | null>(null);
  const [reviewedBy, setReviewedBy] = useState("");
  const [save, setSave] = useState<Save>({ phase: "editing" });

  useEffect(() => {
    if (!id) {
      navigate("/register", { replace: true });
      return;
    }
    fetchRecordById(id)
      .then((record) => {
        if (!record) {
          setState({ phase: "error", message: "That entry no longer exists." });
          return;
        }
        setState({ phase: "loaded", record });
        setFields(record.extracted);
        setReviewedBy(record.verified_by);
      })
      .catch((err: unknown) =>
        setState({ phase: "error", message: err instanceof Error ? err.message : "Could not load that entry." }),
      );
  }, [id, navigate]);

  const editField = (key: SDSFieldKey, text: string) =>
    setFields((f) => {
      if (!f) return f;
      const original = f[key];
      const next: SDSField =
        text.trim() === ""
          ? { value: null, status: original.status === "STATED" ? "NOT_STATED" : original.status, excerpt: original.excerpt, location: original.location }
          : { value: text, status: "STATED", excerpt: original.excerpt, location: original.location };
      return { ...f, [key]: next };
    });

  const datesValid =
    !fields ||
    ([...DATE_FIELDS] as SDSFieldKey[]).every(
      (k) => fields[k].status !== "STATED" || parseSdsDate(fields[k].value) !== null,
    );
  const canSave = reviewedBy.trim().length > 0 && datesValid && save.phase !== "saving";

  async function handleSave() {
    if (state.phase !== "loaded" || !fields || !canSave) return;
    setSave({ phase: "saving" });
    try {
      await updateRecord(state.record, fields, reviewedBy.trim());
      navigate("/register");
    } catch (err) {
      setSave({ phase: "error", message: err instanceof Error ? err.message : "Could not save your changes." });
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link to="/register" className="text-sm text-blue-600 underline">← Back to the register</Link>
        <h1 className="mt-2 text-3xl font-bold text-slate-800">Edit entry</h1>

        {state.phase === "loading" && (
          <div className="mt-6 flex items-center gap-3 text-slate-600">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            Loading…
          </div>
        )}

        {state.phase === "error" && (
          <div role="alert" className="mt-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-800">
            {state.message}
          </div>
        )}

        {state.phase === "loaded" && fields && (
          <>
            <a href={state.record.pdf_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-blue-600 underline">
              Open the safety sheet (PDF)
            </a>

            <div className="mt-5 flex flex-col gap-4">
              {FIELD_KEYS.map((key) => {
                const value = normaliseDisplayDashes(fields[key].value ?? "");
                const invalidDate = DATE_FIELDS.has(key) && fields[key].status === "STATED" && parseSdsDate(fields[key].value) === null;
                return (
                  <div key={key} className={invalidDate ? "rounded-lg bg-amber-50 border border-amber-300 p-3" : ""}>
                    <label className="block font-medium text-slate-700" htmlFor={`edit-${key}`}>
                      {fieldHeader(key)}
                    </label>
                    {LONG_FIELDS.has(key) ? (
                      <textarea
                        id={`edit-${key}`}
                        rows={FIELD_ROWS[key] ?? 2}
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
                        value={value}
                        onChange={(e) => editField(key, e.target.value)}
                        placeholder="Not stated on the sheet"
                      />
                    ) : (
                      <input
                        id={`edit-${key}`}
                        className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                        value={value}
                        onChange={(e) => editField(key, e.target.value)}
                        placeholder="Not stated on the sheet"
                      />
                    )}
                    {invalidDate && <p className="mt-1 text-xs text-amber-800">Use YYYY-MM-DD, YYYY-MM or YYYY.</p>}
                  </div>
                );
              })}

              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <label className="block font-medium text-slate-700" htmlFor="edit-reviewed-by">
                  Checked by <span className="text-red-600">*</span>
                </label>
                <input
                  id="edit-reviewed-by"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-lg"
                  value={reviewedBy}
                  onChange={(e) => setReviewedBy(e.target.value)}
                  placeholder="e.g. AM"
                />
              </div>

              {save.phase === "error" && (
                <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-red-800">
                  {save.message}
                </div>
              )}

              <button
                type="button"
                disabled={!canSave}
                onClick={() => void handleSave()}
                className="w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
              >
                {save.phase === "saving" ? "Saving…" : "Save changes"}
              </button>
              <Link to="/register" className="block text-center text-slate-500 underline">Cancel</Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
