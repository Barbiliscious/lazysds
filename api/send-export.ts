import type { VercelRequest, VercelResponse } from "@vercel/node";
// Relative imports in api/ need explicit .js extensions: these run as
// native ES modules on Vercel ("type": "module"), where Node requires them.
import { emailExportConfigured, sendRegisterExportEmail } from "./_lib/email.js";
import { isAllowedExportUrl, isValidEmail } from "./_lib/export-link.js";

const MAX_RECORD_COUNT = 200;

/**
 * POST /api/send-export
 * Body: { to, url, recordCount }
 * Emails a link to a zip (spreadsheet + PDFs) someone just built from
 * records they picked on the register page, to an address they typed in at
 * that moment. `url` must point at this project's own storage - see
 * ./_lib/export-link.ts - the client never gets to email an arbitrary link.
 * A no-op (ok: false, skipped: true) when RESEND_API_KEY isn't set.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  if (!emailExportConfigured()) {
    res.status(200).json({ ok: false, skipped: true });
    return;
  }

  const body = req.body as { to?: unknown; url?: unknown; recordCount?: unknown } | undefined;
  const { to, url, recordCount } = body ?? {};

  if (typeof to !== "string" || !isValidEmail(to)) {
    res.status(400).json({ error: "That doesn't look like a valid email address." });
    return;
  }
  if (typeof url !== "string" || !isAllowedExportUrl(url, process.env.VITE_SUPABASE_URL)) {
    res.status(400).json({ error: "Invalid export link." });
    return;
  }
  if (typeof recordCount !== "number" || !Number.isInteger(recordCount) || recordCount < 1 || recordCount > MAX_RECORD_COUNT) {
    res.status(400).json({ error: `recordCount must be a whole number between 1 and ${MAX_RECORD_COUNT}.` });
    return;
  }

  const plural = recordCount === 1 ? "record" : "records";
  try {
    await sendRegisterExportEmail({
      to,
      subject: `LazySDS register export - ${recordCount} ${plural}`,
      text: [
        `Someone using LazySDS shared ${recordCount} register ${plural} with you`,
        "(a spreadsheet plus the safety data sheets).",
        "",
        `Download: ${url}`,
        "",
        "This link points to LazySDS's own storage. If you weren't expecting this, you can ignore it.",
      ].join("\n"),
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("send-export failed:", err);
    res.status(502).json({ error: "Could not send the email. Try again in a moment." });
  }
}
