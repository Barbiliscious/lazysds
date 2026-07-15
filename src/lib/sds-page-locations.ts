/**
 * Reads the first PDF page number from an AI evidence location.
 * Examples: "Section 2, SDS page 1" or "Section 8, SDS pages 4 and 5".
 */
export function firstSdsPage(location: string | null): number | null {
  if (!location) return null;

  const match = /\bSDS pages?\s+(\d+)\b/i.exec(location)
    ?? /\bpages?\s+(\d+)\b/i.exec(location);
  if (!match?.[1]) return null;

  const page = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(page) && page > 0 ? page : null;
}
