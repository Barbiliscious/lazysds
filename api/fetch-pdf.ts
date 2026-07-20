import type { VercelRequest, VercelResponse } from "@vercel/node";
import { promises as dns } from "node:dns";
// Relative imports in api/ need explicit .js extensions: these run as
// native ES modules on Vercel ("type": "module"), where Node requires them.
import { checkSdsUrl, isBlockedIp } from "../shared/sds-url.js";

/**
 * POST /api/fetch-pdf
 * Body: { url: string } - a link to an SDS PDF anywhere on the public web.
 * Response: { filename: string, base64: string } or { error: string }.
 *
 * Exists because manufacturers' sites don't send CORS headers, so the browser
 * can't download the PDF itself. Because this makes the SERVER fetch a
 * user-supplied URL, it's SSRF-guarded rather than domain-whitelisted:
 * checkSdsUrl (shared) rejects non-https and private-looking hosts, and here we
 * resolve the hostname's DNS and reject if it points at any private/internal
 * address - re-checking on every redirect hop so a public link can't bounce to
 * an internal one.
 */

// Vercel caps the whole response at ~4.5 MB and base64 adds a third, so
// the PDF itself must stay comfortably under that.
const MAX_PDF_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 5;

/** True only when every IP the hostname resolves to is a public address. */
async function resolvesToPublicOnly(hostname: string): Promise<boolean> {
  try {
    const results = await dns.lookup(hostname, { all: true });
    return results.length > 0 && results.every((r) => !isBlockedIp(r.address));
  } catch {
    return false;
  }
}

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

  // Follow redirects manually so each hop is re-validated (a public URL must
  // not be able to redirect the server to a private address).
  let currentUrl = url.trim();
  let response: Response | null = null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const check = checkSdsUrl(currentUrl);
    if (!check.ok) {
      res.status(400).json({ error: check.reason });
      return;
    }
    if (!(await resolvesToPublicOnly(check.hostname))) {
      res.status(400).json({
        error: `${check.hostname} couldn't be reached at a public address, so it can't be fetched. Download the PDF and upload it instead.`,
      });
      return;
    }

    let hopResponse: Response;
    try {
      hopResponse = await fetch(currentUrl, {
        redirect: "manual",
        signal: AbortSignal.timeout(20_000),
        headers: { Accept: "application/pdf,*/*" },
      });
    } catch {
      res.status(502).json({ error: "That site didn't respond. Check the link, or download the PDF and upload it instead." });
      return;
    }

    if (hopResponse.status >= 300 && hopResponse.status < 400) {
      const location = hopResponse.headers.get("location");
      if (!location) {
        res.status(502).json({ error: "That link redirected without a destination. Download the PDF and upload it instead." });
        return;
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    response = hopResponse;
    break;
  }

  if (!response) {
    res.status(502).json({ error: "That link redirected too many times. Download the PDF and upload it instead." });
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

  const lastSegment = new URL(currentUrl).pathname.split("/").pop() ?? "";
  const filename = lastSegment.toLowerCase().endsWith(".pdf") ? lastSegment : "safety-data-sheet.pdf";

  res.status(200).json({ filename, base64: Buffer.from(bytes).toString("base64") });
}
