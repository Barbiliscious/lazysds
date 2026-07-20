import type { ScannedProduct } from "@shared/types";

/**
 * In-memory hand-off from the scan page's confirmation step to /find,
 * mirroring pending-review.ts: not persisted (a page refresh just loses it,
 * which is fine - re-scanning or typing the name is cheap), so /find can
 * build the strongest possible SDS search from the confirmed structured
 * fields instead of just a combined name.
 */

let scanned: ScannedProduct | null = null;

export function setScannedProduct(product: ScannedProduct): void {
  scanned = product;
}

export function getScannedProduct(): ScannedProduct | null {
  return scanned;
}

export function clearScannedProduct(): void {
  scanned = null;
}
