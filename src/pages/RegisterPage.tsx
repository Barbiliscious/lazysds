import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { SDSField, SDSIndexRecord } from "@shared/types";
import { CURRENCY_DISPLAY, EXTRACTION_STATUS_DISPLAY, fieldCellText } from "@shared/sds-fields";
import { isValidEmail } from "@shared/email";
import { deleteRecord, fetchRegister } from "@/lib/register";
import { downloadRegisterCsv, downloadRegisterXlsx } from "@/lib/export-register";
import { emailSelectedRecords } from "@/lib/email-export";
import QuickReferenceNotice from "@/components/QuickReferenceNotice";

/**
 * The register: every SDS that's been checked and saved, newest first.
 * Entries can be edited or deleted in place (no accounts - see the access
 * model in CLAUDE.md). Rendered as cards, not a table, so it works one-handed
 * on a phone.
 */

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "loaded"; records: SDSIndexRecord[] };

export default function RegisterPage() {
  const [load, setLoad] = useState<LoadState>({ phase: "loading" });
  const [query, setQuery] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [buildingXlsx, setBuildingXlsx] = useState(false);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendTo, setSendTo] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchRegister()
      .then((records) => setLoad({ phase: "loaded", records }))
      .catch((err: unknown) =>
        setLoad({
          phase: "error",
          message: err instanceof Error ? err.message : "Could not load the register.",
        }),
      );
  }, []);

  const records = load.phase === "loaded" ? load.records : [];

  const handleDeleted = (id: string) =>
    setLoad((prev) => (prev.phase === "loaded" ? { ...prev, records: prev.records.filter((r) => r.id !== id) } : prev));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) =>
      [r.extracted.product_name.value, r.extracted.manufacturer_supplier_importer.value]
        .some((v) => v?.toLowerCase().includes(q)),
    );
  }, [records, query]);

  async function handleXlsx() {
    setExportError(null);
    setBuildingXlsx(true);
    try {
      await downloadRegisterXlsx(records);
    } catch {
      setExportError("Could not build the Excel file. Try the CSV download instead.");
    } finally {
      setBuildingXlsx(false);
    }
  }

  function toggleSelectMode() {
    setSelectMode((prev) => !prev);
    setSelectedIds(new Set());
    setSendTo("");
    setSendError(null);
    setSendSuccess(null);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSend() {
    setSendError(null);
    setSendSuccess(null);
    const selected = records.filter((r) => selectedIds.has(r.id));
    setSending(true);
    try {
      await emailSelectedRecords(selected, sendTo);
      setSendSuccess(`Sent ${selected.length === 1 ? "1 record" : `${selected.length} records`} to ${sendTo.trim()}.`);
      setSelectedIds(new Set());
      setSendTo("");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Could not send that email. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <header className="mb-4">
          <Link to="/" className="text-sm text-blue-600 underline">
            ← Add another product
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-800">Safety register</h1>
          <p className="mt-1 text-slate-600">Every product that's been checked and saved, newest first.</p>
        </header>

        <QuickReferenceNotice className="mb-6" />

        {load.phase === "loading" && (
          <div className="flex items-center gap-3 text-slate-600">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            Loading the register…
          </div>
        )}

        {load.phase === "error" && (
          <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-800">
            {load.message}
          </div>
        )}

        {load.phase === "loaded" && records.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-lg font-medium text-slate-700">Nothing in the register yet.</p>
            <Link
              to="/"
              className="mt-4 inline-block rounded-xl bg-blue-600 px-6 py-3 text-lg font-semibold text-white hover:bg-blue-700"
            >
              Add the first product
            </Link>
          </div>
        )}

        {load.phase === "loaded" && records.length > 0 && (
          <>
            {/* Export the whole register regardless of the search filter -
                a compliance export should never be silently partial. */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => downloadRegisterCsv(records)}
                className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Download CSV
              </button>
              <button
                type="button"
                disabled={buildingXlsx}
                onClick={() => void handleXlsx()}
                className="rounded-xl bg-white px-5 py-3 font-semibold text-blue-700 border border-blue-600 hover:bg-blue-50 disabled:opacity-60"
              >
                {buildingXlsx ? "Building…" : "Download Excel"}
              </button>
              <button
                type="button"
                onClick={toggleSelectMode}
                className="rounded-xl bg-white px-5 py-3 font-semibold text-blue-700 border border-blue-600 hover:bg-blue-50"
              >
                {selectMode ? "Cancel emailing" : "Email selected records"}
              </button>
              <span className="text-sm text-slate-500">
                {records.length} {records.length === 1 ? "product" : "products"} in the register
              </span>
            </div>

            {exportError && (
              <div role="alert" className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-800">
                {exportError}
              </div>
            )}

            {selectMode && (
              <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="mb-3 font-medium text-slate-800">
                  Tap the products below to pick which ones to email, then enter where to send them.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="email"
                    inputMode="email"
                    aria-label="Email address to send the selected records to"
                    placeholder="recipient@example.com"
                    className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white p-3 text-lg"
                    value={sendTo}
                    onChange={(e) => setSendTo(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={sending || selectedIds.size === 0 || !isValidEmail(sendTo)}
                    onClick={() => void handleSend()}
                    className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {sending ? "Sending…" : `Send ${selectedIds.size || ""} selected`}
                  </button>
                </div>
                {sendError && (
                  <div role="alert" className="mt-3 rounded-lg bg-red-100 border border-red-200 px-3 py-2 text-red-800">
                    {sendError}
                  </div>
                )}
                {sendSuccess && (
                  <div role="status" className="mt-3 rounded-lg bg-green-100 border border-green-200 px-3 py-2 text-green-800">
                    {sendSuccess}
                  </div>
                )}
              </div>
            )}

            <input
              type="search"
              aria-label="Search the register"
              placeholder="Search product or manufacturer…"
              className="mb-5 w-full rounded-xl border border-slate-300 bg-white p-3 text-lg"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            {visible.length === 0 ? (
              <p className="text-slate-600">No products match &ldquo;{query.trim()}&rdquo;.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {visible.map((record) => (
                  <RecordCard
                    key={record.id}
                    record={record}
                    onDeleted={handleDeleted}
                    selectable={selectMode}
                    selected={selectedIds.has(record.id)}
                    onToggleSelect={() => toggleSelected(record.id)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function RecordCard({
  record,
  onDeleted,
  selectable = false,
  selected = false,
  onToggleSelect,
}: {
  record: SDSIndexRecord;
  onDeleted: (id: string) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const e = record.extracted;
  const organisation = e.manufacturer_supplier_importer.value;
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteRecord(record);
      onDeleted(record.id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete that entry.");
      setDeleting(false);
    }
  }

  return (
    <li
      className={`rounded-xl border bg-white p-4 shadow-sm ${selected ? "border-blue-500 ring-2 ring-blue-200" : "border-slate-200"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          {selectable && (
            <label className="flex cursor-pointer items-center py-1 pr-1">
              <span className="sr-only">
                {e.product_name.value ?? "Select this record"}
              </span>
              <input
                type="checkbox"
                className="h-6 w-6 rounded border-slate-400 text-blue-600"
                checked={selected}
                onChange={onToggleSelect}
              />
            </label>
          )}
          <h2 className="text-lg font-semibold text-slate-800">
            {e.product_name.value ?? <span className="italic text-slate-400">Product name not stated</span>}
          </h2>
        </div>
        <SignalWordBadge field={e.signal_word} />
      </div>

      {organisation && <p className="mt-0.5 text-slate-600">{organisation}</p>}

      <div className="mt-2 flex flex-wrap gap-1.5">
        <CurrencyBadge flag={record.currency_flag} />
        {e.extraction_status !== "READY_FOR_HUMAN_REVIEW" && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
            {EXTRACTION_STATUS_DISPLAY[e.extraction_status]}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <a href={record.pdf_url} target="_blank" rel="noreferrer" className="font-medium text-blue-600 underline">
          Open the safety sheet (PDF)
        </a>
        <span className="text-slate-500">
          Checked by {record.verified_by} · {record.verified_at.slice(0, 10)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-sm">
        <Link to={`/register/edit/${record.id}`} className="font-medium text-blue-600 underline">
          Edit
        </Link>
        {confirming ? (
          <span className="flex items-center gap-2">
            <span className="text-slate-600">Delete this entry?</span>
            <button
              type="button"
              disabled={deleting}
              onClick={() => void handleDelete()}
              className="rounded-lg bg-red-600 px-3 py-1 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Yes, delete"}
            </button>
            <button type="button" disabled={deleting} onClick={() => setConfirming(false)} className="text-slate-500 underline">
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="font-medium text-red-600 underline">
            Delete
          </button>
        )}
      </div>

      {deleteError && (
        <div role="alert" className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-red-800">
          {deleteError}
        </div>
      )}
    </li>
  );
}

// The register card's one at-a-glance hazard signal. Hazardous Chemical and
// Dangerous Goods are still extracted, reviewed, and exported separately
// (they come from different SDS sections and can legitimately disagree) -
// but for a fast-glance list, Signal Word alone conveys the severity.
function SignalWordBadge({ field }: { field: SDSField }) {
  const word = field.status === "STATED" ? field.value?.toUpperCase() : null;
  if (word === "DANGER") {
    return <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-800">DANGER</span>;
  }
  if (word === "WARNING") {
    return <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">WARNING</span>;
  }
  if (word === "NONE") {
    return <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">No signal word</span>;
  }
  return (
    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
      Signal word: {fieldCellText(field)}
    </span>
  );
}

function CurrencyBadge({ flag }: { flag: SDSIndexRecord["currency_flag"] }) {
  if (flag === "CURRENT") return null;
  return (
    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
      {CURRENCY_DISPLAY[flag]}
    </span>
  );
}
