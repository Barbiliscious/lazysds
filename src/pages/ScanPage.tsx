import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isValidBarcode, normalizeBarcode } from "@shared/barcode";
import type { ScannedProduct } from "@shared/types";
import { lookupBarcode, saveBarcodeMapping } from "@/lib/api-client";
import { startBarcodeScanner, type RunningScanner } from "@/lib/barcode-scanner";
import { setScannedProduct } from "@/lib/scanned-product";

/**
 * Scan (or type) a product barcode, look it up (our own saved mappings ->
 * free/keyed barcode databases -> an AI web-search fallback that reads real
 * search results), let the worker confirm or correct the proposed product,
 * then hand it to /find. The confirmed product is saved as the mapping for
 * that barcode, so the next scan of the same item is instant.
 */

type Lookup =
  | { phase: "idle" }
  | { phase: "looking-up"; code: string }
  | { phase: "confirming"; code: string; product: ScannedProduct }
  | { phase: "not-found"; code: string }
  | { phase: "error"; message: string };

const SOURCE_LABELS: Record<string, string> = {
  saved_mapping: "Previously scanned and confirmed",
  open_facts: "Open Products/Food/Beauty Facts",
  upc_database: "UPC Database",
  eandata: "eandata",
  web_search: "AI web search - please check this carefully",
};

function sourceLabel(sourceProvider: string | null): string {
  if (!sourceProvider) return "Unknown source";
  return SOURCE_LABELS[sourceProvider] ?? sourceProvider;
}

export default function ScanPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<RunningScanner | null>(null);
  const [cameraState, setCameraState] = useState<"off" | "starting" | "on" | "unavailable">("off");
  const [typedCode, setTypedCode] = useState("");
  const [lookup, setLookup] = useState<Lookup>({ phase: "idle" });
  const [saving, setSaving] = useState(false);

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
      setLookup(product ? { phase: "confirming", code, product } : { phase: "not-found", code });
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

  function editField(key: keyof ScannedProduct, value: string) {
    if (lookup.phase !== "confirming") return;
    setLookup({ ...lookup, product: { ...lookup.product, [key]: value.trim() === "" ? null : value } });
  }

  async function handleConfirm() {
    if (lookup.phase !== "confirming" || lookup.product.name.trim() === "") return;
    const product = lookup.product;

    setSaving(true);
    try {
      await saveBarcodeMapping(product, null);
    } catch (err) {
      // Best-effort only - the worker's task is finding the SDS, not
      // babysitting the mapping cache. A failed save just means the next
      // scan of this barcode repeats the lookup instead of being instant.
      console.error("saving barcode mapping failed:", err);
    } finally {
      setSaving(false);
    }

    setScannedProduct(product);
    navigate(`/find?product=${encodeURIComponent(product.name)}`);
  }

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

        {lookup.phase === "confirming" && (
          <ConfirmProductCard
            code={lookup.code}
            product={lookup.product}
            saving={saving}
            onChange={editField}
            onConfirm={() => void handleConfirm()}
          />
        )}

        {lookup.phase === "not-found" && (
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-slate-700">
              Nothing knows barcode <strong>{lookup.code}</strong> yet - not our saved list, the product databases,
              or a web search. That happens sometimes with newer or less common products.
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

function ConfirmProductCard({
  code,
  product,
  saving,
  onChange,
  onConfirm,
}: {
  code: string;
  product: ScannedProduct;
  saving: boolean;
  onChange: (key: keyof ScannedProduct, value: string) => void;
  onConfirm: () => void;
}) {
  const lowConfidence = product.confidence === "low" || product.confidence === "medium";
  return (
    <section className="rounded-xl border border-green-300 bg-green-50 p-5">
      <p className="text-sm text-green-800">Barcode {code} looks like:</p>

      {lowConfidence && (
        <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {product.confidence === "low" ? "Low" : "Medium"} confidence match - please check these details carefully
          before confirming.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-3">
        <Field label="Product name" value={product.name} onChange={(v) => onChange("name", v)} required />
        <Field label="Brand" value={product.brand ?? ""} onChange={(v) => onChange("brand", v)} />
        <Field
          label="Manufacturer's product code"
          value={product.manufacturerProductCode ?? ""}
          onChange={(v) => onChange("manufacturerProductCode", v)}
        />
        <div className="flex gap-3">
          <Field label="Size" value={product.size ?? ""} onChange={(v) => onChange("size", v)} className="flex-1" />
          <Field label="Variant" value={product.variant ?? ""} onChange={(v) => onChange("variant", v)} className="flex-1" />
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Source: {sourceLabel(product.sourceProvider)}
        {product.sourceUrl && (
          <>
            {" "}
            ·{" "}
            <a href={product.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
              view source
            </a>
          </>
        )}
      </p>

      <button
        type="button"
        disabled={product.name.trim() === "" || saving}
        onClick={onConfirm}
        className="mt-4 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
      >
        {saving ? "Saving…" : "That's right - find its safety sheet"}
      </button>
      <p className="mt-2 text-sm text-slate-500">
        Wrong or incomplete? Fix the fields above before confirming - it's saved for next time too.
      </p>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}) {
  const id = `scan-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700" htmlFor={id}>
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      <input
        id={id}
        className="mt-1 w-full rounded-lg border border-slate-300 p-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Not known"
      />
    </div>
  );
}
