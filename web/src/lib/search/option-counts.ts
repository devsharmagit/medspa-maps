import pool from "@/lib/db";
import {
  BROAD_CONCERN_CHILDREN,
  haversineMilesSql,
  resolveLocationScope,
  type LocationScope,
} from "@/lib/search/location-scope";

/**
 * Clinic counts per catalog treatment / concern, scoped to the user's location.
 *
 * These are the numbers rendered next to each option in the "Treatment or
 * Condition" dropdown, so they MUST match what the search engine would return
 * for that option at the same location — see `web/scripts/verify-option-counts.mjs`,
 * which asserts exactly that against `runSearch`.
 *
 * The matching predicates below are deliberate mirrors of `query.ts`:
 *  - treatments: `s.slug` + `s.is_active` + the dental exclusion;
 *  - concerns: membership from `scraped`/`manual` sources, minus a `removed`
 *    veto, over the broad→child expanded slug set.
 * Changing one without the other makes the dropdown lie.
 */

export interface OptionCount {
  slug: string;
  name: string;
  count: number;
}

export interface SearchOptionCounts {
  treatments: OptionCount[];
  concerns: OptionCount[];
  scope: { kind: LocationScope["kind"]; radiusMiles: number | null; label: string };
}

/** Clinics offering nothing are still catalog rows — this is the clinic set. */
interface ScopeSql {
  /** SQL for a `scope(clinic_id)` CTE body. */
  sql: string;
  params: (string | number)[];
  /** Next free positional parameter index after `params`. */
  nextIdx: number;
}

/**
 * The set of clinics the counts are computed over, as a CTE body.
 * Mirrors the filters `query.ts` applies for the same `LocationScope`.
 */
function scopeCte(scope: LocationScope): ScopeSql {
  switch (scope.kind) {
    case "origin": {
      // Radius filter over the clinic's nearest active branch, same haversine
      // the search engine uses (PostGIS is unusable — see location-scope.ts).
      const distance = haversineMilesSql(1, 2, "l.lat::float", "l.lng::float");
      return {
        sql: `
          SELECT DISTINCT l.clinic_id
          FROM clinic_locations l
          JOIN clinics cl ON cl.id = l.clinic_id AND cl.is_active = TRUE
          WHERE l.is_active = TRUE AND l.lat IS NOT NULL AND l.lng IS NOT NULL
            AND ${distance} <= $3`,
        params: [scope.lat, scope.lng, scope.radiusMiles],
        nextIdx: 4,
      };
    }
    case "state":
      return {
        sql: `
          SELECT DISTINCT l.clinic_id
          FROM clinic_locations l
          JOIN clinics cl ON cl.id = l.clinic_id AND cl.is_active = TRUE
          WHERE l.is_active = TRUE AND (l.state = $1 OR l.state ILIKE $2)`,
        params: [scope.abbr, scope.fullName],
        nextIdx: 3,
      };
    case "text":
      return {
        sql: `
          SELECT DISTINCT l.clinic_id
          FROM clinic_locations l
          JOIN clinics cl ON cl.id = l.clinic_id AND cl.is_active = TRUE
          WHERE l.is_active = TRUE
            AND (l.city ILIKE $1 OR l.state ILIKE $1 OR l.zip ILIKE $1)`,
        params: [`%${scope.term}%`],
        nextIdx: 2,
      };
    case "national":
      return {
        sql: `SELECT cl.id AS clinic_id FROM clinics cl WHERE cl.is_active = TRUE`,
        params: [],
        nextIdx: 1,
      };
  }
}

function scopeLabel(scope: LocationScope): string {
  switch (scope.kind) {
    case "origin":
      return `within ${scope.radiusMiles} miles`;
    case "state":
      return scope.fullName;
    case "text":
      return scope.term;
    case "national":
      return "United States";
  }
}

async function treatmentCounts(scope: ScopeSql): Promise<OptionCount[]> {
  const counted = await pool.query<OptionCount>(
      `WITH scope AS (${scope.sql})
       SELECT s.slug, s.name, count(DISTINCT cs.clinic_id)::int AS count
       FROM services s
       LEFT JOIN clinic_services cs
         ON cs.service_id = s.id
        AND cs.is_active = TRUE
        AND cs.clinic_id IN (SELECT clinic_id FROM scope)
       WHERE s.is_active = TRUE
         AND s.name !~* '(dentistry|dental|orthodont|veneer)'
       GROUP BY s.slug, s.name`,
      scope.params,
  );

  const countBySlug = new Map(counted.rows.map((r) => [r.slug, r.count]));

  // Picking an option sends its slug as `?q=`, so the honest count is the count
  // of whatever slug resolveSearchQuery will actually run.
  //
  // Since 2026-09-06 that is always the option's own slug: the resolver's FIRST
  // pass is an exact match against the live catalog, and every option here comes
  // from that same catalog, so an option slug can never reach the curated-alias
  // layer.
  //
  // This used to apply `matchService(row.slug)` to follow brand→bucket
  // collapses. Doing that now is not a no-op, it is WRONG — matchService still
  // fuzzy-matches "lip-fillers" to `dermal-fillers` and "rf-microneedling" to
  // `microneedling`, so the dropdown showed Lip Fillers as 512 next to a search
  // returning 36. Both are core entries in their own right now; the alias layer
  // no longer speaks for them.
  return counted.rows
    .map((row) => ({
      slug: row.slug,
      name: row.name,
      // A slug missing from the counted set is a dental row the search's own
      // join excludes — it genuinely returns nothing.
      count: countBySlug.get(row.slug) ?? 0,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

async function concernCounts(scope: ScopeSql): Promise<OptionCount[]> {
  // A broad concern also matches its children, so its count is over the whole
  // expanded slug set. The expansion is built in SQL as (catalog_slug →
  // match_slug) pairs: every concern maps to itself, plus the broad→child pairs
  // from BROAD_CONCERN_CHILDREN.
  //
  // That map is empty post-2026-09-06 — the children were folded into their
  // parents at the data layer — so the UNION currently adds nothing. Both this
  // and query.ts read the same map, which is what keeps the dropdown count and
  // the search total equal; verify with scripts/verify-option-counts.mjs.
  const broadParents: string[] = [];
  const broadChildren: string[] = [];
  for (const [parent, children] of Object.entries(BROAD_CONCERN_CHILDREN)) {
    for (const child of children) {
      broadParents.push(parent);
      broadChildren.push(child);
    }
  }
  const pIdx = scope.nextIdx;
  const cIdx = scope.nextIdx + 1;

  const { rows } = await pool.query(
    `WITH scope AS (${scope.sql}),
     expansion AS (
       SELECT co.slug AS catalog_slug, co.slug AS match_slug
       FROM concerns co WHERE co.is_active = TRUE
       UNION
       SELECT * FROM unnest($${pIdx}::text[], $${cIdx}::text[]) AS v(catalog_slug, match_slug)
     ),
     matched AS (
       SELECT DISTINCT cc.clinic_id, con.slug
       FROM clinic_concerns cc
       JOIN concerns con ON con.id = cc.concern_id AND con.is_active = TRUE
       WHERE cc.is_active = TRUE
         AND cc.source IN ('scraped', 'manual')
         AND cc.clinic_id IN (SELECT clinic_id FROM scope)
     )
     SELECT co.slug, co.name,
       count(DISTINCT m.clinic_id) FILTER (
         WHERE NOT EXISTS (
           SELECT 1
           FROM clinic_concerns cc2
           JOIN concerns con2 ON con2.id = cc2.concern_id AND con2.is_active = TRUE
           JOIN expansion e2 ON e2.match_slug = con2.slug AND e2.catalog_slug = co.slug
           WHERE cc2.clinic_id = m.clinic_id
             AND cc2.is_active = TRUE
             AND cc2.source = 'removed'
         )
       )::int AS count
     FROM concerns co
     LEFT JOIN expansion e ON e.catalog_slug = co.slug
     LEFT JOIN matched m ON m.slug = e.match_slug
     WHERE co.is_active = TRUE
     GROUP BY co.slug, co.name
     ORDER BY count DESC, co.name`,
    [...scope.params, broadParents, broadChildren],
  );
  return rows as OptionCount[];
}

export async function getSearchOptionCounts(
  searchParams: URLSearchParams,
): Promise<SearchOptionCounts> {
  const { scope } = resolveLocationScope(searchParams);
  const cte = scopeCte(scope);
  const [treatments, concerns] = await Promise.all([
    treatmentCounts(cte),
    concernCounts(cte),
  ]);
  return {
    treatments,
    concerns,
    scope: {
      kind: scope.kind,
      radiusMiles: scope.kind === "origin" ? scope.radiusMiles : null,
      label: scopeLabel(scope),
    },
  };
}
