import type { VercelRequest, VercelResponse } from "@vercel/node";
// Relative imports in api/ need explicit .js extensions: these run as
// native ES modules on Vercel ("type": "module"), where Node requires them.
import { checkSdsUrl } from "../shared/sds-url.js";

/**
 * POST /api/fetch-pdf
 * Body: { url: string } - a link to an SDS PDF on a trusted domain.
 * Response: { filename: string, base64: string } or { error: string }.
 *
 * Exists because manufacturers' sites don't send CORS headers, so the
 * browser can't download the PDF itself. The trusted-domain whitelist
 * (shared/config/sds-domains.ts) is the safety boundary: this function
 * refuses to fetch from anywhere else.
 */

// Vercel caps the whole response at ~4.5 MB and base64 adds a third, so
// the PDF itself must stay comfortably under that.
const MAX_PDF_BYTES = 3 * 1024 * 1024;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  const url: unknown = (req.body as { url?: unknown } | undefined)?.url;
  if (typeof url !== "string" || url.trim().length === 0) {
    res.status(400).json({ error: 'Request body must be JSON with a non-empty "url" string' });
    return;
  }

  const check = checkSdsUrl(url);
  if (!check.ok) {
    res.status(400).json({ error: check.reason });
    return;
  }

  let response: Response;
  try {
    response = await fetch(url.trim(), {
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
      headers: { Accept: "application/pdf,*/*" },
    });
  } catch {
    res.status(502).json({ error: "That site didn't respond. Check the link, or download the PDF and upload it instead." });
    return;
  }

  // The site may have redirected - the place we actually landed must be
  // trusted too, or the whitelist would be trivial to bypass.
  const landed = checkSdsUrl(response.url);
  if (!landed.ok) {
    res.status(400).json({ error: "That link redirected to a site that isn't on the trusted list. Download the PDF and upload it instead." });
    return;
  }

  if (!response.ok) {
    res.status(502).json({ error: `That site answered with an error (${response.status}). Check the link still works in your browser.` });
    return;
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_PDF_BYTES) {
    res.status(413).json({ error: "That PDF is too large to fetch automatically. Download it and upload it instead." });
    return;
  }

  // Trust the file's own magic bytes, not the Content-Type header -
  // plenty of servers label PDFs as octet-stream or even text/html.
  const isPdf = bytes.length > 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
  if (!isPdf) {
    res.status(400).json({ error: "That link isn't a PDF file. Make sure you copy the address of the PDF itself, not the page around it." });
    return;
  }

  const lastSegment = new URL(response.url).pathname.split("/").pop() ?? "";
  const filename = lastSegment.toLowerCase().endsWith(".pdf") ? lastSegment : "safety-data-sheet.pdf";

  res.status(200).json({ filename, base64: Buffer.from(bytes).toString("base64") });
}
