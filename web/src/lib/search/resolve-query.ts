/**
 * search/resolve-query.ts — turn a `q` into a real catalog entry, or nothing.
 *
 * A treatment/concern search is a CHOICE, not free text. `q` must be the exact
 * slug of an active catalog row; anything else resolves to nothing and returns
 * no results.
 *
 * This used to be four passes — exact slug, then a retired-slug redirect, then
 * curated brand aliases, then a Dice-similarity fuzzy match at 0.7. The intent
 * was good: someone typing "Morpheus8" got RF Microneedling. The effect was
 * worse than a dead end, because the user asked for one thing and was shown
 * results for another, which reads as a broken site rather than as a helpful
 * redirect. Guessing was removed on 2026-09-07, along with the free-text input
 * that made guessing necessary (see components/ui/searchable-dropdown.tsx).
 *
 * TWO THINGS THAT LOOK RELATED AND ARE NOT:
 *
 * 1. `LEGACY_TREATMENT_REDIRECT` in taxonomy/core-catalog.ts still exists and is
 *    still load-bearing — for INGEST, not search. taxonomy/catalog-policy.ts
 *    uses it to place a SCRAPED "Morpheus8" onto RF Microneedling so the closed
 *    catalog does not drop that clinic's row. Search no longer consults it;
 *    ingest must.
 * 2. `matchService` / `bestCatalogMatch` in taxonomy/canonical.ts are likewise
 *    still used by the ingest path. Only search stopped calling them.
 *
 * Because this is now an exact lookup, the option-count contract in
 * search/option-counts.ts holds trivially: picking an option sends its own slug,
 * which resolves to itself, so the count beside an option always equals the
 * total the search returns.
 */

import { query } from "@/lib/db";

export type ResolvedQuery =
  | { kind: "treatment"; slug: string; name: string }
  | { kind: "concern"; slug: string; name: string }
  | { kind: "unresolved" };

interface CatRow {
  slug: string;
  name: string;
}

/**
 * Resolve `q` against the live catalogs by exact slug. Treatments win over
 * concerns when both match, because the treatment box is the one that sends `q`
 * — though with a single grouped dropdown a slug collision cannot occur in
 * practice.
 */
export async function resolveSearchQuery(q: string): Promise<ResolvedQuery> {
  const slug = q.trim().toLowerCase();
  if (!slug) return { kind: "unresolved" };

  const [services, concerns] = await Promise.all([
    query<CatRow>(`SELECT slug, name FROM services WHERE is_active = true AND slug = $1`, [slug]),
    query<CatRow>(`SELECT slug, name FROM concerns WHERE is_active = true AND slug = $1`, [slug]),
  ]);

  if (services[0]) return { kind: "treatment", slug: services[0].slug, name: services[0].name };
  if (concerns[0]) return { kind: "concern", slug: concerns[0].slug, name: concerns[0].name };
  return { kind: "unresolved" };
}

/**
 * The active concern with this slug, or null.
 *
 * Used by the `?condition=` branch, which never goes through
 * `resolveSearchQuery` — it receives a slug straight from a link. Returns the
 * row rather than a boolean so the response can echo the concern's display
 * name without a second query.
 */
export async function activeConcern(slug: string): Promise<CatRow | null> {
  const clean = slug.trim().toLowerCase();
  if (!clean) return null;
  const rows = await query<CatRow>(
    `SELECT slug, name FROM concerns WHERE is_active = true AND slug = $1`,
    [clean],
  );
  return rows[0] ?? null;
}
