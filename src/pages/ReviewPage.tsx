import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getPendingReview, clearPendingReview } from "@/lib/pending-review";
import { advance, clearQueue, hasNext, queuePosition } from "@/lib/review-queue";
import { prepareReview } from "@/lib/sds-intake";
import ReviewForm from "@/components/ReviewForm";

/**
 * Owns the review queue: reviews the current SDS, and after each save advances
 * to the next PDF in a multi-upload batch (extracting it on the way). The
 * per-sheet form lives in ReviewForm, re-mounted via `key` so its state resets
 * cleanly between sheets. A single upload is just a batch of one.
 */

type Phase =
  | { kind: "reviewing" }
  | { kind: "advancing"; name: string }
  | { kind: "advance-error"; message: string }
  | { kind: "done"; savedCount: number };

export default function ReviewPage() {
  const navigate = useNavigate();
  const [pending, setPending] = useState(() => getPendingReview());
  // Bumped on every advance so ReviewForm re-mounts fresh for the next sheet.
  const [itemKey, setItemKey] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: "reviewing" });
  const [savedCount, setSavedCount] = useState(0);

  // A refresh loses the in-memory hand-off - go back to the start.
  useEffect(() => {
    if (!pending) navigate("/", { replace: true });
  }, [pending, navigate]);

  if (!pending) return null;

  // Pull the next queued file and extract it, or finish the batch.
  async function loadNext(completed: number) {
    const next = advance();
    if (!next) {
      clearQueue();
      setPhase({ kind: "done", savedCount: completed });
      return;
    }
    setPhase({ kind: "advancing", name: next.name });
    try {
      await prepareReview(next, "upload", () => {});
      setPending(getPendingReview());
      setItemKey((k) => k + 1);
      setPhase({ kind: "reviewing" });
    } catch (err) {
      setPhase({
        kind: "advance-error",
        message: err instanceof Error ? err.message : "That sheet couldn't be read.",
      });
    }
  }

  function handleSaved() {
    const completed = savedCount + 1;
    setSavedCount(completed);
    if (hasNext()) {
      void loadNext(completed);
    } else {
      clearQueue();
      setPhase({ kind: "done", savedCount: completed });
    }
  }

  function handleCancel() {
    clearQueue();
    clearPendingReview();
    navigate("/");
  }

  if (phase.kind === "done") {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-6 p-6 text-center">
        <span className="text-6xl" aria-hidden>✅</span>
        <h1 className="text-2xl font-bold text-slate-800">
          {phase.savedCount > 1 ? `${phase.savedCount} sheets added to the register` : "Added to the register"}
        </h1>
        <Link to="/" className="rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white hover:bg-blue-700">
          Add another product
        </Link>
        <Link to="/register" className="text-blue-600 underline">See the full register</Link>
      </main>
    );
  }

  if (phase.kind === "advancing") {
    const pos = queuePosition();
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
        <p className="text-lg font-medium text-slate-700">
          Reading the next sheet{pos ? ` (${pos.current} of ${pos.total})` : ""}…
        </p>
        <p className="text-sm text-slate-500">{phase.name}</p>
      </main>
    );
  }

  if (phase.kind === "advance-error") {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-5 p-6 text-center">
        <span className="text-5xl" aria-hidden>⚠️</span>
        <h1 className="text-xl font-bold text-slate-800">That sheet couldn't be read</h1>
        <p className="max-w-sm text-slate-600">{phase.message}</p>
        <div className="flex flex-col gap-3">
          {hasNext() && (
            <button
              type="button"
              onClick={() => void loadNext(savedCount)}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Skip it and read the next sheet
            </button>
          )}
          <Link to="/" className="text-blue-600 underline" onClick={() => clearQueue()}>
            Finish and go home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <ReviewForm
      key={itemKey}
      pending={pending}
      position={queuePosition()}
      onSaved={handleSaved}
      onCancel={handleCancel}
    />
  );
}
