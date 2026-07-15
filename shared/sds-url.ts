// .js extension required: api/fetch-pdf.ts imports this file at runtime,
// and api/ code runs as native ESM on Vercel (see CLAUDE.md import rules).
// Vite resolves the .js specifier back to the .ts file for the browser.
import { TRUSTED_SDS_DOMAINS } from "./config/sds-domains.js";

/**
 * URL logic for Flow B (finding an SDS on the web). Pure functions so both
 * the api/ fetch route and the React app share one definition of "trusted",
 * and so it's all unit-testable.
 */

export type UrlCheck = { ok: true; hostname: string } | { ok: false; reason: string };

/** True when hostname is the domain itself or one of its subdomains. */
function matchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith("." + domain);
}

/**
 * Accepts only https URLs whose host is on the trusted SDS domain list
 * (shared/config/sds-domains.ts). Everything else gets a plain-language
 * reason the UI can show directly.
 */
export function checkSdsUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "That doesn't look like a web address. Copy the full link, starting with https://" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, reason: "Only secure (https) links are accepted." };
  }
  const hostname = url.hostname.toLowerCase();
  if (!TRUSTED_SDS_DOMAINS.some((d) => matchesDomain(hostname, d))) {
    return {
      ok: false,
      reason:
        `${hostname} isn't on the trusted sites list, so we can't fetch from it automatically. ` +
        "Download the PDF yourself and upload it instead - or ask whoever looks after this app " +
        "to add the site to shared/config/sds-domains.ts.",
    };
  }
  return { ok: true, hostname };
}

/**
 * A plain web search the user opens in a new tab - no search API needed.
 * filetype:pdf keeps results to direct PDF links whose address can be
 * copied straight back into the app.
 */
export function buildSdsSearchUrl(productName: string): string {
  const query = `"${productName.trim()}" safety data sheet filetype:pdf`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}
