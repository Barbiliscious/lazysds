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
 * Emails a one-row spreadsheet copy plus the source PDF to whoever
 * REGISTER_NOTIFY_EMAIL is set to. `skipped: true` means the feature isn't
 * configured server-side (no RESEND_API_KEY / REGISTER_NOTIFY_EMAIL) - not
 * an error, just off.
 */
export async function sendRegisterCopyEmail(payload: {
  productName: string;
  xlsxBase64: string;
  xlsxFilename: string;
  pdfBase64: string;
  pdfFilename: string;
}): Promise<{ ok: boolean; skipped?: boolean }> {
  return postJson<{ ok: boolean; skipped?: boolean }>("/api/send-copy", payload);
}
