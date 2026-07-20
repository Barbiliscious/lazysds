/**
 * URL safety logic for Flow B (fetching an SDS PDF the user found on the web).
 *
 * We deliberately do NOT keep a whitelist of manufacturer domains - there are
 * too many to maintain, and the worker needs to fetch from any of them. The
 * real risk in "server fetches a user-supplied URL" is SSRF: being tricked
 * into fetching an internal/cloud-metadata address. So instead of asking
 * "is this brand trusted?", we ask "is this a normal public https address?".
 *
 * These pure checks (https only, no private/loopback/link-local IP literals)
 * run in both the browser and the server. The server additionally resolves the
 * hostname's DNS and re-checks the resulting IPs, and re-validates every
 * redirect hop - see api/fetch-pdf.ts. Pure so it's all unit-testable.
 */

export type UrlCheck = { ok: true; hostname: string } | { ok: false; reason: string };

/**
 * True for IPs that must never be fetched from a server: private, loopback,
 * link-local (incl. the 169.254.169.254 cloud-metadata address), CGNAT,
 * multicast and reserved ranges. Anything it can't parse is treated as
 * blocked (fail closed). Accepts IPv4, IPv6, and IPv4-mapped IPv6.
 */
export function isBlockedIp(ip: string): boolean {
  const addr = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(addr);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if ([a, b, Number(v4[3]), Number(v4[4])].some((n) => n > 255)) return true; // malformed
    if (a === 0 || a === 10 || a === 127) return true;      // this-host, private, loopback
    if (a === 169 && b === 254) return true;                // link-local + metadata
    if (a === 172 && b >= 16 && b <= 31) return true;       // 172.16.0.0/12
    if (a === 192 && b === 168) return true;                // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true;      // CGNAT 100.64.0.0/10
    if (a >= 224) return true;                              // multicast / reserved
    return false;
  }

  if (addr.includes(":")) {
    if (addr === "::1" || addr === "::") return true;       // loopback / unspecified
    const mapped = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(addr); // ::ffff:1.2.3.4
    if (mapped) return isBlockedIp(mapped[1]!);
    if (/^fe[89ab]/.test(addr)) return true;                // fe80::/10 link-local
    if (/^f[cd]/.test(addr)) return true;                   // fc00::/7 unique-local
    if (addr.startsWith("ff")) return true;                 // multicast
    return false;
  }

  return true; // not an IP literal we recognise - fail closed
}

/** Blocks obvious non-public hosts (localhost, *.local, private IP literals) without DNS. */
function isBlockedHostLiteral(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) {
    return true;
  }
  const looksLikeIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(":");
  return looksLikeIp && isBlockedIp(h);
}

/**
 * Accepts any normal public https URL. Rejects non-https, links with embedded
 * credentials or non-standard ports, and hosts that are plainly private/local.
 * The server still resolves DNS and re-checks the real IPs before fetching.
 */
export function checkSdsUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "That doesn't look like a web address. Copy the full link, starting with https://" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, reason: "Only secure (https) links can be fetched. Make sure the address starts with https://" };
  }
  if (url.username !== "" || url.password !== "") {
    return { ok: false, reason: "That link contains login details, which can't be fetched. Paste a plain link to the PDF." };
  }
  if (url.port !== "" && url.port !== "443") {
    return { ok: false, reason: "That link uses an unusual port and can't be fetched. Paste the plain link to the PDF, or upload it instead." };
  }
  const hostname = url.hostname.toLowerCase();
  if (isBlockedHostLiteral(hostname)) {
    return {
      ok: false,
      reason:
        `${hostname} is a private or local address, which can't be fetched for security reasons. ` +
        "Paste the manufacturer's public https link to the PDF, or download it and upload it instead.",
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
