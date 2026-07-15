import type { ExtractedIndexRow } from "@shared/types";

/**
 * The only place the frontend talks to /api routes. Components call these
 * functions and never construct fetch requests themselves.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Could not reach the server - check your connection and try again.", 0);
  }

  const payload: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  if (payload === null || typeof payload !== "object") {
    // Happens under plain `npm run dev`, where /api routes aren't served.
    throw new ApiError("The server gave an unexpected reply. If running locally, use `vercel dev`.", res.status);
  }
  return payload as T;
}

/** Sends page-tagged SDS text to /api/extract and returns the index row. */
export async function extractSDS(text: string, pageCount: number): Promise<ExtractedIndexRow> {
  const { extracted } = await postJson<{ extracted: ExtractedIndexRow }>("/api/extract", {
    text,
    pageCount,
  });
  return extracted;
}

/**
 * Asks /api/fetch-pdf to download an SDS PDF from a trusted site (the
 * browser can't - manufacturers' sites don't allow cross-origin reads)
 * and hands it back as a File, ready for the normal intake pipeline.
 */
export interface BarcodeProduct {
  name: string;
  brand: string | null;
}

/** Looks a barcode up in the free product databases; null = not known. */
export async function lookupBarcode(code: string): Promise<BarcodeProduct | null> {
  const { product } = await postJson<{ product: BarcodeProduct | null }>("/api/barcode", { code });
  return product;
}

export async function fetchSdsPdf(url: string): Promise<File> {
  const { filename, base64 } = await postJson<{ filename: string; base64: string }>("/api/fetch-pdf", { url });
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new File([bytes], filename, { type: "application/pdf" });
}
