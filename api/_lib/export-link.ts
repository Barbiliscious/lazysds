/**
 * Validation for POST /api/send-export. Both checks exist because this
 * endpoint is public and unauthenticated (see the access model in
 * CLAUDE.md) - without them it would let anyone email an arbitrary link to
 * an arbitrary address using this app's verified sending domain.
 */

export { isValidEmail } from "../../shared/email.js";

const EXPORT_PATH_PREFIX = "/storage/v1/object/public/sds-pdfs/exports/";

/**
 * True only for a link into this project's own Supabase storage export
 * path. Rejects everything else, including a URL that merely contains the
 * expected path as a substring elsewhere (e.g. a look-alike host) - origin
 * must match exactly.
 */
export function isAllowedExportUrl(url: string, supabaseUrl: string | undefined): boolean {
  if (!supabaseUrl) return false;
  let parsed: URL;
  let base: URL;
  try {
    parsed = new URL(url);
    base = new URL(supabaseUrl);
  } catch {
    return false;
  }
  if (parsed.origin !== base.origin) return false;
  return parsed.pathname.startsWith(EXPORT_PATH_PREFIX);
}
