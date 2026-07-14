/**
 * Barcode (GTIN) helpers — pure and shared so the scan page can validate
 * before calling the API and the API can validate again server-side.
 */

/** Strips spaces/dashes people naturally type between digit groups. */
export function normalizeBarcode(raw: string): string {
  return raw.replace(/[\s-]+/g, "");
}

/**
 * True for a plausible retail barcode: 8–14 digits (EAN-8, UPC-A, EAN-13,
 * GTIN-14) with a valid GS1 check digit — the standard mod-10 checksum
 * computed right-to-left with alternating 3/1 weights.
 */
export function isValidBarcode(raw: string): boolean {
  const code = normalizeBarcode(raw);
  if (!/^\d{8,14}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop() as number;
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}
