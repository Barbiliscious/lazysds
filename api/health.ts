import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * GET /api/health — proves the serverless side is alive.
 * Deliberately reports nothing sensitive.
 */
export default function handler(_req: VercelRequest, res: VercelResponse): void {
  res.status(200).json({ ok: true, service: "lazysds-api" });
}
