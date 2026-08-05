/**
 * The SharePoint document library the register's PDFs get uploaded to,
 * configured via VITE_SHAREPOINT_LIBRARY_URL rather than hardcoded, so it
 * can be changed without a code change (see .env.example). Used to build
 * the SDS Link column: base URL + SDS Filename.
 */
function configuredBaseUrl(): string | null {
  const raw = import.meta.env.VITE_SHAREPOINT_LIBRARY_URL as string | undefined;
  const trimmed = raw?.trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : null;
}

/** Joins the configured library URL with a filename; null if unconfigured. */
export function buildSharePointLink(filename: string): string | null {
  const base = configuredBaseUrl();
  return base ? `${base}/${filename}` : null;
}
