/**
 * Pure formatting helpers (no filesystem) — safe to import from client
 * components such as the homepage article carousel.
 */

/** "2026-08-21" -> "August 21, 2026". */
export function formatBlogDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "August 21, 2026 · 7 min read". */
export function formatBlogMeta(iso: string, readingMinutes: number): string {
  return `${formatBlogDate(iso)} · ${readingMinutes} min read`;
}
