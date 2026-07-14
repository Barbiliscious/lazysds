import { useCallback, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { extractPdfText } from "@/lib/pdf-text";
import { extractSDS } from "@/lib/api-client";
import { setPendingReview } from "@/lib/pending-review";

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
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        setStep({ phase: "error", message: "That doesn't look like a PDF. The safety sheet needs to be a PDF file." });
        return;
      }
      try {
        setStep({ phase: "reading-pdf" });
        const text = await extractPdfText(file);
        if (text.length < 50) {
          setStep({
            phase: "error",
            message:
              "We couldn't read any text in that PDF — it might be a scanned image. Try a PDF downloaded from the manufacturer's website.",
          });
          return;
        }
        setStep({ phase: "extracting" });
        const extracted = await extractSDS(text);
        setPendingReview({ file, text, extracted });
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

      <p className="text-sm text-slate-400 max-w-md text-center">
        Don't have the PDF? Search for the product name plus &ldquo;SDS&rdquo; on the manufacturer's website.
        Product search inside this app is coming soon.
      </p>
    </main>
  );
}
