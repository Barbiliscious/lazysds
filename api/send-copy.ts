import type { VercelRequest, VercelResponse } from "@vercel/node";
// Relative imports in api/ need explicit .js extensions: these run as
// native ES modules on Vercel ("type": "module"), where Node requires them.
import { emailCopyConfigured, sendRegisterCopyEmail } from "./_lib/email.js";

/**
 * POST /api/send-copy
 * Body: { productName, xlsxBase64, xlsxFilename, pdfBase64, pdfFilename }
 * Emails a one-row spreadsheet copy plus the source PDF to
 * REGISTER_NOTIFY_EMAIL. A no-op (ok: false, skipped: true) when the
 * feature isn't configured - saving a record must never depend on this.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  if (!emailCopyConfigured()) {
    res.status(200).json({ ok: false, skipped: true });
    return;
  }

  const body = req.body as
    | { productName?: unknown; xlsxBase64?: unknown; xlsxFilename?: unknown; pdfBase64?: unknown; pdfFilename?: unknown }
    | undefined;
  const { productName, xlsxBase64, xlsxFilename, pdfBase64, pdfFilename } = body ?? {};
  if (
    typeof xlsxBase64 !== "string" || xlsxBase64.length === 0 ||
    typeof xlsxFilename !== "string" || xlsxFilename.length === 0 ||
    typeof pdfBase64 !== "string" || pdfBase64.length === 0 ||
    typeof pdfFilename !== "string" || pdfFilename.length === 0
  ) {
    res.status(400).json({ error: "Request body must include xlsxBase64/xlsxFilename and pdfBase64/pdfFilename" });
    return;
  }
  const subjectName = typeof productName === "string" && productName.trim() !== "" ? productName.trim() : "SDS";

  try {
    await sendRegisterCopyEmail({
      subject: `LazySDS register copy - ${subjectName}`,
      text: `Attached: the register row and safety data sheet for ${subjectName}.\n\nThis is an automated copy - the record is already saved in the register.`,
      attachments: [
        { filename: xlsxFilename, content: xlsxBase64 },
        { filename: pdfFilename, content: pdfBase64 },
      ],
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("send-copy failed:", err);
    res.status(502).json({ error: "Could not send the email copy. The record is still saved in the register." });
  }
}
