/**
 * Sends transactional email via Resend's HTTP API. Server-side only -
 * RESEND_API_KEY exists solely in Vercel env vars / .env.local. No SDK
 * needed: Resend's API is one POST with a JSON body.
 *
 * Sends from a verified domain (lazysds.com), so - unlike Resend's shared
 * sandbox sender - delivery isn't restricted to the Resend account's own
 * address.
 */

const FROM_ADDRESS = "LazySDS <notify@lazysds.com>";

export interface EmailAttachment {
  filename: string;
  /** Base64-encoded file content (no "data:" prefix). */
  content: string;
}

async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  attachments?: EmailAttachment[];
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY not set - email is not configured.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [params.to],
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

/**
 * The "email me a copy" receipt sent automatically whenever a record is
 * saved. Both RESEND_API_KEY and REGISTER_NOTIFY_EMAIL are optional - when
 * either is missing the feature is simply off; saving a record must never
 * depend on email working.
 */
export function emailCopyConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.REGISTER_NOTIFY_EMAIL);
}

export async function sendRegisterCopyEmail(params: {
  subject: string;
  text: string;
  attachments: EmailAttachment[];
}): Promise<void> {
  const to = process.env.REGISTER_NOTIFY_EMAIL;
  if (!process.env.RESEND_API_KEY || !to) {
    throw new Error("RESEND_API_KEY / REGISTER_NOTIFY_EMAIL not set - email copy is not configured.");
  }
  await sendEmail({ to, ...params });
}

/**
 * The "email selected records to someone" feature: a link to a zip a human
 * picked from the register, sent to whatever address they typed in at that
 * moment (see api/send-export.ts for the recipient/URL validation). Only
 * needs RESEND_API_KEY - there's no fixed recipient to configure.
 */
export function emailExportConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendRegisterExportEmail(params: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  await sendEmail(params);
}
