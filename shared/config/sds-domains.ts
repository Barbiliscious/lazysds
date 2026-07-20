/**
 * ═══════════════════════════════════════════════════════════════════
 *  EDIT ME - trusted SDS domain whitelist
 * ═══════════════════════════════════════════════════════════════════
 * The web-search adapter (Flow B) only accepts PDF results hosted on
 * these domains. Add a manufacturer's site here to start trusting it;
 * remove a line to stop. Subdomains are included automatically
 * (e.g. "sigmaaldrich.com" also matches "www.sigmaaldrich.com").
 */

export const TRUSTED_SDS_DOMAINS: string[] = [
  // Big SDS aggregators / suppliers
  "chemwatch.net",
  "sigmaaldrich.com",
  "fishersci.com",
  "thermofisher.com",
  "merckmillipore.com",

  // AU-relevant manufacturers of common workplace chemicals
  "rb.com", // Reckitt (Mortein, Glen 20, etc.)
  "sccjohnson.com",
  "clorox.com.au",
  "recochem.com.au",
  "cspa.com.au",
  "selleys.com.au",
  "dulux.com.au",
  "wd40.com.au",
  "dymark.com.au", // Dymark - aerosol / line-marking paints
];
