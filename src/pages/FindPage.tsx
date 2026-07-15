import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { buildSdsSearchUrl } from "@shared/sds-url";
import { fetchSdsPdf } from "@/lib/api-client";
import { prepareReview } from "@/lib/sds-intake";

/**
 * Flow B: the user doesn't have the SDS PDF yet. Deliberately built
 * without any search API - the app opens an ordinary web search in a new
 * tab, the user copies the PDF's address back in, and the server fetches
 * it (from trusted sites only - shared/config/sds-domains.ts). When a
 * search API key exists one day, it can replace the copy-paste hop
 * without changing anything else on this page.
 */

type Step =
  | { phase: "idle" }
  | { phase: "fetching-pdf" }
  | { phase: "reading-pdf" }
  | { phase: "extracting" }
  | { phase: "error"; message: string };

export default function FindPage() {
  const navigate = useNavigate();
  // The scan page arrives here with ?product=… already worked out.
  const [searchParams] = useSearchParams();
  const [productName, setProductName] = useState(searchParams.get("product") ?? "");
  const [pdfLink, setPdfLink] = useState("");
  const [step, setStep] = useState<Step>({ phase: "idle" });

  const busy = step.phase === "fetching-pdf" || step.phase === "reading-pdf" || step.phase === "extracting";

  async function handleFetch() {
    setStep({ phase: "fetching-pdf" });
    try {
      const file = await fetchSdsPdf(pdfLink);
      await prepareReview(file, "web_search", (phase) => setStep({ phase }));
      navigate("/review");
    } catch (err) {
      setStep({
        phase: "error",
        message: err instanceof Error ? err.message : "Something went wrong fetching that link. Please try again.",
      });
    }
  }

  const busyLabel =
    step.phase === "fetching-pdf"
      ? "Fetching the PDF…"
      : step.phase === "reading-pdf"
        ? "Opening the PDF…"
        : "Reading the safety sheet…";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-md px-4 py-8 flex flex-col gap-6">
        <header>
          <Link to="/" className="text-sm text-blue-600 underline">
            ← Back
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-800">Find the safety sheet</h1>
          <p className="mt-1 text-slate-600">
            No PDF? No problem - most manufacturers publish safety data sheets on their websites.
          </p>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-800">
            <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white">
              1
            </span>
            Search for it
          </h2>
          <label className="mt-3 block text-sm font-medium text-slate-700" htmlFor="product-name">
            What's the product called?
          </label>
          <input
            id="product-name"
            className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-lg"
            placeholder="e.g. Mortein Outdoor"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
          />
          <p className="mt-2 text-sm text-slate-500">
            Not sure of the name?{" "}
            <Link to="/scan" className="text-blue-600 underline">
              Scan the product's barcode
            </Link>{" "}
            and we'll try to work it out.
          </p>
          <button
            type="button"
            disabled={productName.trim().length === 0}
            onClick={() => window.open(buildSdsSearchUrl(productName), "_blank", "noopener")}
            className="mt-3 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
          >
            Search the web (opens a new tab)
          </button>
          <p className="mt-2 text-sm text-slate-500">
            Look for a result from the manufacturer's own website, then copy the link to the PDF.
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-800">
            <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white">
              2
            </span>
            Paste the link here
          </h2>
          <label className="mt-3 block text-sm font-medium text-slate-700" htmlFor="pdf-link">
            Address of the PDF
          </label>
          <input
            id="pdf-link"
            type="url"
            inputMode="url"
            className="mt-1 w-full rounded-lg border border-slate-300 p-3"
            placeholder="https://…"
            value={pdfLink}
            onChange={(e) => setPdfLink(e.target.value)}
          />
          <button
            type="button"
            disabled={pdfLink.trim().length === 0 || busy}
            onClick={() => void handleFetch()}
            className="mt-3 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
          >
            {busy ? busyLabel : "Fetch it and read it for me"}
          </button>
        </section>

        {step.phase === "error" && (
          <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-800">
            {step.message}
          </div>
        )}

        <p className="text-sm text-slate-500 text-center">
          If fetching doesn't work, download the PDF to your device and{" "}
          <Link to="/" className="text-blue-600 underline">
            upload it from the home screen
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
