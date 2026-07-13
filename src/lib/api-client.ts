import type { ExtractedSDS } from "@shared/types";

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
    throw new ApiError("Could not reach the server — check your connection and try again.", 0);
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

/** Sends SDS text to /api/extract and returns the structured fields. */
export async function extractSDS(text: string): Promise<ExtractedSDS> {
  const { extracted } = await postJson<{ extracted: ExtractedSDS }>("/api/extract", { text });
  return extracted;
}
