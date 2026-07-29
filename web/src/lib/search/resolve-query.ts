/**
 * search/resolve-query.ts — turn a typed `q` into a real catalog entry, or nothing.
 *
 * The search box is a treatment/condition search ("Search treatments…"), not a
 * free-text index. It used to run `clinic_services.raw_name ILIKE '%q%'`, which
 * meant two things:
 *
 *   1. any scraped string was searchable — including the phone numbers, street
 *      addresses and page titles that unresolved rows had left in the data;
 *   2. arbitrary input like "abc" matched whatever happened to contain "abc",
 *      so nonsense queries returned confident-looking results.
 *
 * Now a query must name something in the catalog. Treatments are tried first,
 * then concerns (so typing a condition into the treatment box still works — it
 * is redirected to the concern branch rather than silently returning junk). An
 * unresolved query returns no results, and the response says so.
 */

import { query } from "@/lib/db";
import { bestCatalogMatch, matchService, normalize } from "@/lib/taxonomy/canonical";

export type ResolvedQuery =
  | { kind: "treatment"; slug: string; name: string }
  | { kind: "concern"; slug: string; name: string }
  | { kind: "unresolved" };

interface CatRow {
  slug: string;
  name: string;
}

/** Minimum Dice similarity for a typo/variant to count as the same entry. */
const FUZZY_THRESHOLD = 0.7;

function exact(rows: CatRow[], q: string): CatRow | undefined {
  const n = normalize(q);
  return rows.find((r) => normalize(r.name) === n || normalize(r.slug) === n);
}

function fuzzy(rows: CatRow[], q: string): CatRow | undefined {
  const hit = bestCatalogMatch(
    q,
    rows.map((r) => ({ slug: r.slug, name: r.name, aliases: [] })),
    FUZZY_THRESHOLD
  );
  return hit ? rows.find((r) => r.slug === hit.entry.slug) : undefined;
}

/**
 * Resolve `q` against the live catalogs. Treatment wins over concern when both
 * match, because the treatment box is the one that sends `q`.
 */
export async function resolveSearchQuery(q: string): Promise<ResolvedQuery> {
  const trimmed = q.trim();
  if (!trimmed) return { kind: "unresolved" };

  const [services, concerns] = await Promise.all([
    query<CatRow>(`SELECT slug, name FROM services WHERE is_active = true`),
    query<CatRow>(`SELECT slug, name FROM concerns WHERE is_active = true`),
  ]);

  // Curated aliases first — "tox", "wrinkle relaxers" → botox — then the live
  // catalog by exact name/slug, then a bounded fuzzy match for typos.
  //
  // This order is DELIBERATE and must stay: the curated aliases encode
  // brand→bucket collapses that intentionally over-return a superset. "Dysport"
  // resolving to `botox` surfaces 562 clinics rather than the 174 that happen to
  // spell out Dysport; "Juvederm" → `dermal-fillers` surfaces 523 rather than 20.
  // Putting the live catalog first would silently narrow every brand search.
  //
  // Treatments whose own name was being shadowed by this order — `Facials`
  // (144 clinics) and `Dermaplaning` (94) both resolved to `hydrafacial`,
  // `Facelift` to `prp-prf` — were fixed in canonical.ts instead, by removing the
  // generic facial aliases and by refusing to fuzzy-match single-token input.
  // That is the narrower fix: it unshadows those rows without touching the
  // intentional collapses.
  const curated = matchService(trimmed);
  if (curated.slug) {
    const row = services.find((s) => s.slug === curated.slug);
    if (row) return { kind: "treatment", slug: row.slug, name: row.name };
  }

  const svc = exact(services, trimmed) ?? fuzzy(services, trimmed);
  if (svc) return { kind: "treatment", slug: svc.slug, name: svc.name };

  const con = exact(concerns, trimmed) ?? fuzzy(concerns, trimmed);
  if (con) return { kind: "concern", slug: con.slug, name: con.name };

  return { kind: "unresolved" };
}
