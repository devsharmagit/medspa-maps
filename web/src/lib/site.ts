/**
 * Canonical site constants. Centralized here so metadata, canonical URLs,
 * JSON-LD, the sitemap, and robots all resolve against one source of truth
 * instead of the hardcoded strings that were previously scattered around.
 */
export const SITE_URL = "https://medspamaps.com";
export const SITE_NAME = "Medspa Maps";

/** Build an absolute URL for a site-relative path (e.g. "/blog/foo"). */
export function absoluteUrl(path: string): string {
  if (!path) return SITE_URL;
  return path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}
