import { useCallback, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { prepareReview } from "@/lib/sds-intake";

type Step =
  | { phase: "idle" }
  | { phase: "reading-pdf" }
  | { phase: "extracting" }
  | { phase: "error"; message: string };

/**
 * Home screen: one big obvious action. The user might be in a store
 * cupboard holding a can of fly spray — no jargon, big tap targets.
 */
export default function HomePage() {
  const [step, setStep] = useState<Step>({ phase: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const busy = step.phase === "reading-pdf" || step.phase === "extracting";

  const handleFile = useCallback(
    async (file: File) => {
      try {
        await prepareReview(file, "upload", (phase) => setStep({ phase }));
        navigate("/review");
      } catch (err) {
        setStep({
          phase: "error",
          message: err instanceof Error ? err.message : "Something went wrong reading that file. Please try again.",
        });
      }
    },
    [navigate],
  );

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center px-4 py-10 gap-8">
      <header className="text-center max-w-md">
        <h1 className="text-3xl font-bold text-slate-800">LazySDS</h1>
        <p className="mt-2 text-slate-600">
          Add a chemical product to your safety register. Upload its safety data sheet (the PDF from the
          manufacturer) and we'll read it for you.
        </p>
      </header>

      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a safety data sheet PDF"
        onClick={() => !busy && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) fileInputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file && !busy) void handleFile(file);
        }}
        className={`w-full max-w-md rounded-2xl border-4 border-dashed p-10 text-center transition-colors cursor-pointer select-none ${
          dragOver ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-white hover:border-blue-400"
        } ${busy ? "opacity-60 pointer-events-none" : ""}`}
      >
        {busy ? (
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <p className="text-lg font-medium text-slate-700">
              {step.phase === "reading-pdf" ? "Opening the PDF…" : "Reading the safety sheet…"}
            </p>
            <p className="text-sm text-slate-500">This usually takes a few seconds.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <span className="text-5xl" aria-hidden>
              📄
            </span>
            <p className="text-xl font-semibold text-slate-800">Upload the safety sheet (PDF)</p>
            <p className="text-slate-500">Tap here to choose a file, or drag one in.</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void handleFile(file);
          }}
        />
      </div>

      <Link
        to="/register"
        className="rounded-xl border border-slate-300 bg-white px-6 py-4 text-lg font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700"
      >
        See what's already in the register
      </Link>

      {step.phase === "error" && (
        <div role="alert" className="w-full max-w-md rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-800">
          {step.message}
        </div>
      )}

      <p className="text-sm text-slate-500 max-w-md text-center">
        Don't have the PDF?{" "}
        <Link to="/find" className="text-blue-600 underline">
          We'll help you find it
        </Link>{" "}
        — or{" "}
        <Link to="/scan" className="text-blue-600 underline">
          scan the product's barcode
        </Link>
        .
      </p>
    </main>
  );
}
