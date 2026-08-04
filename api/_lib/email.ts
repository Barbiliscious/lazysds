/**
 * Sends the "email me a copy" receipt via Resend's HTTP API. Server-side
 * only - RESEND_API_KEY exists solely in Vercel env vars / .env.local.
 * No SDK needed: Resend's API is one POST with a JSON body.
 *
 * Both RESEND_API_KEY and REGISTER_NOTIFY_EMAIL are optional. When either is
 * missing the feature is simply off - saving a record must never depend on
 * email working.
 */

export interface EmailAttachment {
  filename: string;
  /** Base64-encoded file content (no "data:" prefix). */
  content: string;
}

export function emailCopyConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.REGISTER_NOTIFY_EMAIL);
}

export async function sendRegisterCopyEmail(params: {
  subject: string;
  text: string;
  attachments: EmailAttachment[];
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.REGISTER_NOTIFY_EMAIL;
  if (!apiKey || !to) {
    throw new Error("RESEND_API_KEY / REGISTER_NOTIFY_EMAIL not set - email copy is not configured.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // Resend's shared sandbox sender - works with no domain setup, but can
      // only deliver to the email address the Resend account itself is
      // registered under. That's fine here: REGISTER_NOTIFY_EMAIL is meant
      // to be that same address.
      from: "LazySDS <onboarding@resend.dev>",
      to: [to],
      subject: params.subject,
      text: params.text,
      attachments: params.attachments,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend rejected the email (${res.status}): ${body.slice(0, 300)}`);
  }
}
