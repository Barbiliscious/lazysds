import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isValidBarcode, normalizeBarcode } from "@shared/barcode";
import { lookupBarcode, type BarcodeProduct } from "@/lib/api-client";
import { startBarcodeScanner, type RunningScanner } from "@/lib/barcode-scanner";

/**
 * Phase 5, key-free: scan (or type) a product barcode, look it up in the
 * free Open*Facts databases, and hand the product name to the /find flow.
 * Those databases are crowdsourced, so "not found" is a normal outcome
 * with a web-search fallback - never a dead end.
 */

type Lookup =
  | { phase: "idle" }
  | { phase: "looking-up"; code: string }
  | { phase: "found"; code: string; product: BarcodeProduct }
  | { phase: "not-found"; code: string }
  | { phase: "error"; message: string };

export default function ScanPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<RunningScanner | null>(null);
  const [cameraState, setCameraState] = useState<"off" | "starting" | "on" | "unavailable">("off");
  const [typedCode, setTypedCode] = useState("");
  const [lookup, setLookup] = useState<Lookup>({ phase: "idle" });

  useEffect(() => {
    return () => scannerRef.current?.stop();
  }, []);

  async function handleCode(raw: string) {
    const code = normalizeBarcode(raw);
    if (!isValidBarcode(code)) {
      setLookup({ phase: "error", message: "That doesn't look like a complete barcode - check the digits and try again." });
      return;
    }
    scannerRef.current?.stop();
    scannerRef.current = null;
    setCameraState("off");
    setLookup({ phase: "looking-up", code });
    try {
      const product = await lookupBarcode(code);
      setLookup(product ? { phase: "found", code, product } : { phase: "not-found", code });
    } catch (err) {
      setLookup({
        phase: "error",
        message: err instanceof Error ? err.message : "The lookup failed. Please try again.",
      });
    }
  }

  async function startCamera() {
    setCameraState("starting");
    try {
      if (!videoRef.current) throw new Error("no video element");
      scannerRef.current = await startBarcodeScanner(videoRef.current, (code) => void handleCode(code));
      setCameraState("on");
    } catch {
      // No camera, no permission, or no HTTPS - typing still works.
      setCameraState("unavailable");
    }
  }

  // Prepend the brand only when it isn't already part of the name -
  // "Glen 20" + "Glen 20 Original Scent" must not double up.
  const searchName =
    lookup.phase === "found"
      ? lookup.product.brand &&
        !lookup.product.name.toLowerCase().includes(lookup.product.brand.toLowerCase())
        ? `${lookup.product.brand} ${lookup.product.name}`
        : lookup.product.name
      : "";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-md px-4 py-8 flex flex-col gap-6">
        <header>
          <Link to="/" className="text-sm text-blue-600 underline">
            ← Back
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-slate-800">Scan the barcode</h1>
          <p className="mt-1 text-slate-600">
            We'll try to work out what the product is, then help you find its safety sheet.
          </p>
        </header>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <video
            ref={videoRef}
            className={`w-full rounded-lg bg-slate-900 ${cameraState === "on" || cameraState === "starting" ? "aspect-video" : "hidden"}`}
            muted
            playsInline
          />
          {cameraState === "off" && (
            <button
              type="button"
              onClick={() => void startCamera()}
              className="w-full rounded-xl bg-blue-600 px-5 py-4 text-lg font-semibold text-white hover:bg-blue-700"
            >
              📷 Open the camera
            </button>
          )}
          {cameraState === "starting" && <p className="mt-2 text-slate-600">Starting the camera…</p>}
          {cameraState === "on" && <p className="mt-2 text-slate-600">Point the camera at the barcode.</p>}
          {cameraState === "unavailable" && (
            <p role="alert" className="rounded-lg bg-amber-50 border border-amber-300 px-3 py-2 text-amber-900">
              The camera couldn't start - no problem, type the numbers instead.
            </p>
          )}

          <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="barcode">
            Or type the numbers printed under the barcode
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="barcode"
              inputMode="numeric"
              className="w-full rounded-lg border border-slate-300 p-3 text-lg tracking-wider"
              placeholder="e.g. 9310031000"
              value={typedCode}
              onChange={(e) => setTypedCode(e.target.value)}
            />
            <button
              type="button"
              disabled={typedCode.trim().length === 0 || lookup.phase === "looking-up"}
              onClick={() => void handleCode(typedCode)}
              className="shrink-0 rounded-xl bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
            >
              Look it up
            </button>
          </div>
        </section>

        {lookup.phase === "looking-up" && (
          <div className="flex items-center gap-3 text-slate-600">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            Checking barcode {lookup.code}…
          </div>
        )}

        {lookup.phase === "found" && (
          <section className="rounded-xl border border-green-300 bg-green-50 p-5">
            <p className="text-sm text-green-800">Barcode {lookup.code} looks like:</p>
            <p className="mt-1 text-xl font-semibold text-slate-800">
              {lookup.product.name}
              {lookup.product.brand && <span className="font-normal text-slate-600"> - {lookup.product.brand}</span>}
            </p>
            <button
              type="button"
              onClick={() => navigate(`/find?product=${encodeURIComponent(searchName)}`)}
              className="mt-4 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Find its safety sheet
            </button>
            <p className="mt-2 text-sm text-slate-500">Not the right product? Just type the name on the next screen.</p>
          </section>
        )}

        {lookup.phase === "not-found" && (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-slate-700">
              The free product databases don't know barcode <strong>{lookup.code}</strong>. That happens a lot -
              they're volunteer-built.
            </p>
            <button
              type="button"
              onClick={() =>
                window.open(`https://www.google.com/search?q=${encodeURIComponent(lookup.code)}`, "_blank", "noopener")
              }
              className="mt-4 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
            >
              Search the web for this barcode
            </button>
            <p className="mt-3 text-sm text-slate-600">
              The search usually shows the product's name - then{" "}
              <Link to="/find" className="text-blue-600 underline">
                use it to find the safety sheet
              </Link>
              .
            </p>
          </section>
        )}

        {lookup.phase === "error" && (
          <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-red-800">
            {lookup.message}
          </div>
        )}
      </div>
    </main>
  );
}
