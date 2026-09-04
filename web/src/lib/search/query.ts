import { resolveSearchQuery, type ResolvedQuery } from "@/lib/search/resolve-query";
import pool from "@/lib/db";
import {
  conditionSlugSet,
  haversineMilesSql,
  resolveLocationScope,
} from "@/lib/search/location-scope";

// Shared clinic-search engine. Extracted verbatim from the /api/search route so
// the search PAGE can render the first result page server-side (crawlable HTML)
// by calling this in-process, while the API route stays a thin wrapper for the
// client-side filter/pagination/map fetches. Accepts a URLSearchParams so both
// callers pass the exact same inputs and get byte-identical output.

// ─── Response types ───────────────────────────────────────────────────────────

export interface SearchPagination {
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface SearchQueryEcho {
  q: string;
  condition: string;
  /** What `q` resolved to — null when it named nothing in the catalog. */
  resolved: { kind: string; slug: string; name: string } | null;
  location: string;
  sort: string;
  tier: string;
  lat: number | null;
  lng: number | null;
  radius: number | null;
  rating: number | null;
}

/**
 * The nearest practices that DO offer the searched treatment/condition, found
 * by dropping the geographic filters after a search returned nothing. Present
 * only on that path, so every existing consumer of the payload is unaffected.
 */
export interface NearbyFallback {
  results: Record<string, unknown>[];
  /** How many exist nationwide, of which `results` holds the closest few. */
  total: number;
  /** Distance to the closest one, or null when there was no origin to measure from. */
  nearestMiles: number | null;
  /** What was given up to find them. */
  relaxedFrom: { kind: "radius" | "state" | "text"; radiusMiles: number | null; location: string };
}

export interface SearchListResponse {
  results: Record<string, unknown>[];
  total: number;
  pagination: SearchPagination;
  query: SearchQueryEcho;
  nearby?: NearbyFallback;
}

export interface SearchPinsResponse {
  pins: Record<string, unknown>[];
}

/**
 * Runs the clinic search. Returns the list payload, or the `{ pins }` payload
 * when the caller set `?pins`. Throws on DB error (callers handle it).
 */
export async function runSearch(
  searchParams: URLSearchParams,
  /** Internal: false on the relaxed retry, so the fallback can't recurse. */
  allowRelax = true,
): Promise<SearchListResponse | SearchPinsResponse> {
  const qRaw = searchParams.get("q") || "";
  let q = qRaw;
  let condition = searchParams.get("condition") || "";
  const location = searchParams.get("location") || "";
  const tier = searchParams.get("tier") || "";

  // Treatment+condition combos are NOT supported: when both arrive, the
  // condition wins and q is dropped (the UI enforces this too — one grouped
  // dropdown sets either q or condition, never both).
  if (condition) q = "";

  // A typed treatment must NAME something in the catalog. Anything else — "abc",
  // a phone number, a page title — resolves to nothing and returns no results,
  // rather than ILIKE-matching whatever scraped string happened to contain it.
  // A query that turns out to be a CONDITION is handed to the concern branch, so
  // typing "melasma" into the treatment box still does the right thing.
  let resolvedQuery: ResolvedQuery = { kind: "unresolved" };
  if (q) {
    resolvedQuery = await resolveSearchQuery(q);
    if (resolvedQuery.kind === "concern") {
      condition = resolvedQuery.slug;
      q = "";
    }
  }

  // Pagination params
  const pageRaw = searchParams.get("page");
  const limitRaw = searchParams.get("limit");
  const page = pageRaw && Number.isFinite(Number(pageRaw)) ? Math.max(1, Number(pageRaw)) : 1;
  const limit = limitRaw && Number.isFinite(Number(limitRaw)) ? Math.min(Math.max(1, Number(limitRaw)), 50) : 50;
  const offset = (page - 1) * limit;

  // Geo / rating params
  const ratingRaw = searchParams.get("rating");

  // Ecommerce-style zip/area search: a location of the form "37201" or
  // "Nashville, TN" is geo-resolvable, so distance handles it — the text
  // filter must NOT also run ("Nashville, TN" never ILIKE-matches the city
  // column "Nashville", and "37201" would exclude the clinic one zip over).
  // Shared with /api/search-options so the count shown next to a dropdown
  // option is scoped exactly like the search it triggers.
  const resolvedLocation = resolveLocationScope(searchParams);
  const latNum = resolvedLocation.origin?.lat ?? NaN;
  const lngNum = resolvedLocation.origin?.lng ?? NaN;
  const hasOrigin = resolvedLocation.origin !== null;
  const radiusNum = resolvedLocation.echoRadius; // echoed; the applied one lives in `scope`

  const ratingNum = ratingRaw !== null && Number.isFinite(Number(ratingRaw))
    ? Number(ratingRaw)
    : null;

  // Default sort is 'distance' when an origin is present, else 'rating'
  const sort = searchParams.get("sort") || (hasOrigin ? "distance" : "rating"); // distance | rating | name | reviews

  const conditions: string[] = ["c.is_active = TRUE"];
  const params: (string | number | string[])[] = [];
  let paramIdx = 1;

  // Haversine distance in MILES from (lat,lng) origin, computed in SQL.
  // Distance = NEAREST point among the clinic's own coords AND all of its
  // active clinic_locations. This makes distance work for clinics whose
  // primary coords live only in clinic_locations (the common case after
  // import) and gives multi-location clinics the honest "closest branch".
  let distanceExpr = "NULL::float";
  let originLatParam: number | null = null;
  let originLngParam: number | null = null;
  // When a state/text location filter is active, the display-location LATERAL
  // (ploc) should prefer the branch that actually matched the filter — so a
  // multi-location clinic searched by state shows its in-state address, not
  // its primary one. Filled in by the location-filter block below; injected
  // into both ploc ORDER BYs ahead of `is_primary`.
  let locMatchOrder = "";
  if (hasOrigin) {
    const latParam = paramIdx;
    const lngParam = paramIdx + 1;
    originLatParam = latParam;
    originLngParam = lngParam;
    distanceExpr = `(
      SELECT MIN(${haversineMilesSql(latParam, lngParam, "pt.lat", "pt.lng")})
      FROM (
        SELECT cl2.lat::float AS lat, cl2.lng::float AS lng
        FROM clinic_locations cl2
        WHERE cl2.clinic_id = c.id AND cl2.is_active = TRUE
          AND cl2.lat IS NOT NULL AND cl2.lng IS NOT NULL
      ) pt
    )`;
    params.push(latNum, lngNum);
    paramIdx += 2;
    // NOTE: clinics with no coordinates anywhere get distance_miles = NULL
    // (sorted last within their group) rather than disappearing the moment a
    // user shares their location. The radius hard-filter below naturally
    // excludes null-coordinate clinics.
  }

  // Treatment search — by the CANONICAL slug the query resolved to, never by
  // raw scraped text. An unresolved query matches nothing at all.
  if (q) {
    if (resolvedQuery.kind !== "treatment") {
      conditions.push("FALSE");
    } else {
      conditions.push(`(s.id IS NOT NULL AND s.slug = $${paramIdx})`);
      params.push(resolvedQuery.slug);
      paramIdx += 1;
    }
  }

  // Condition/concern search — slug-based membership (scraped ∪ manual −
  // removed). A clinic matches when it lists the concern; no evidence-quote
  // gate (that table was removed). All active concerns qualify.
  if (condition) {
    const conditionSlugs = conditionSlugSet(condition);
    conditions.push(`(
      EXISTS (
        SELECT 1 FROM clinic_concerns cc
        JOIN concerns con ON con.id = cc.concern_id
        WHERE cc.clinic_id = c.id AND cc.is_active = TRUE
          AND cc.source IN ('scraped', 'manual')
          AND con.is_active = TRUE AND con.slug = ANY($${paramIdx}::text[])
      )
      AND NOT EXISTS (
        SELECT 1 FROM clinic_concerns cc2
        JOIN concerns con2 ON con2.id = cc2.concern_id
        WHERE cc2.clinic_id = c.id AND cc2.is_active = TRUE
          AND cc2.source = 'removed' AND con2.slug = ANY($${paramIdx}::text[])
      )
    )`);
    params.push(conditionSlugs);
    paramIdx++;
  }

  // Location search — checks both clinics table AND clinic_locations for
  // multi-location clinics. Skipped when the typed location was resolved to
  // an origin (zip / "City, ST"): distance handles it, and a string match on
  // "37201" would wrongly exclude the clinic one zip over.
  if (resolvedLocation.scope.kind === "state" || resolvedLocation.scope.kind === "text") {
    const abbr = resolvedLocation.scope.kind === "state" ? resolvedLocation.scope.abbr : undefined;
    const fullName = resolvedLocation.scope.kind === "state" ? resolvedLocation.scope.fullName : undefined;
    if (abbr && fullName) {
      conditions.push(`
        EXISTS (
          SELECT 1 FROM clinic_locations cl
          WHERE cl.clinic_id = c.id AND cl.is_active = true
            AND (cl.state = $${paramIdx} OR cl.state ILIKE $${paramIdx + 1})
        )`);
      locMatchOrder = `(cl.state = $${paramIdx} OR cl.state ILIKE $${paramIdx + 1}) DESC,`;
      params.push(abbr, fullName);
      paramIdx += 2;
    } else {
      conditions.push(`
        EXISTS (
          SELECT 1 FROM clinic_locations cl
          WHERE cl.clinic_id = c.id AND cl.is_active = true
            AND (cl.city ILIKE $${paramIdx} OR cl.state ILIKE $${paramIdx} OR cl.zip ILIKE $${paramIdx})
        )`);
      locMatchOrder = `(cl.city ILIKE $${paramIdx} OR cl.state ILIKE $${paramIdx} OR cl.zip ILIKE $${paramIdx}) DESC,`;
      params.push(`%${location}%`);
      paramIdx++;
    }
  }

  // Rating filter — minimum rating (internal avg, else external/Google).
  if (ratingNum !== null) {
    conditions.push(`COALESCE(c.avg_rating, c.ext_rating) >= $${paramIdx}`);
    params.push(ratingNum);
    paramIdx++;
  }

  // Radius hard-filter — when the user explicitly picks a distance band, OR
  // when the origin came from a typed zip / "City, ST" (ecommerce behavior:
  // "37201" means near 37201, not the whole country — default 50 miles).
  // A browser-geolocation origin alone still only enables distance display /
  // sorting and never silently hides clinics.
  if (resolvedLocation.scope.kind === "origin") {
    conditions.push(`${distanceExpr} <= $${paramIdx}`);
    params.push(resolvedLocation.scope.radiusMiles);
    paramIdx++;
  } else if (hasOrigin) {
    // An origin with no radius filter (bare browser geolocation) is used only
    // for distance display/sort, so the count query — which selects no columns —
    // would never mention $lat/$lng while still being handed them, and Postgres
    // rejects the statement with "could not determine data type of parameter $1".
    // This always-true clause keeps the placeholders present so both queries can
    // share one param list.
    conditions.push(`(${distanceExpr} IS NOT NULL OR TRUE)`);
  }

  // ── Opt-in "pins" mode (map view on /search) ────────────────────────────
  // Returns EVERY matching clinic's coordinates (no pagination), reusing the
  // exact same filters (conditions/params) as the list so the pin set always
  // matches the results. One pin per clinic, at the same branch the card
  // shows (nearest to origin when present, else primary). Minimal columns.
  // Returns early, so the default response below is completely unchanged.
  if (searchParams.get("pins")) {
    const pinsQuery = `
      SELECT DISTINCT ON (c.id)
        c.id AS clinic_id,
        c.slug AS clinic_slug,
        c.name AS clinic_name,
        ploc.lat AS lat,
        ploc.lng AS lng,
        ploc.city AS city,
        ploc.state AS state,
        COALESCE(c.phone, ploc.phone) AS phone,
        c.website,
        c.booking_url,
        c.avg_rating,
        c.ext_rating,
        c.review_count,
        (
          SELECT COALESCE(cdn_url, source_url) FROM images
          WHERE entity_type = 'clinic' AND entity_id = c.id
            AND role = 'logo' AND scrape_status = 'ok'
          ORDER BY sort_order LIMIT 1
        ) AS logo_url,
        (
          SELECT COALESCE(cdn_url, source_url) FROM images
          WHERE entity_type = 'clinic' AND entity_id = c.id
            AND role IN ('cover', 'gallery') AND scrape_status = 'ok'
          ORDER BY (role = 'cover') DESC, sort_order LIMIT 1
        ) AS cover_image_url,
        c.featured
      FROM clinics c
      LEFT JOIN LATERAL (
        SELECT cl.city, cl.state, cl.phone, cl.lat, cl.lng
        FROM clinic_locations cl
        WHERE cl.clinic_id = c.id AND cl.is_active = TRUE
        ORDER BY ${
          originLatParam !== null
            ? `(CASE WHEN cl.lat IS NULL OR cl.lng IS NULL THEN NULL ELSE
                 3959 * acos(GREATEST(-1, LEAST(1,
                   cos(radians($${originLatParam})) * cos(radians(cl.lat))
                   * cos(radians(cl.lng) - radians($${originLngParam}))
                   + sin(radians($${originLatParam})) * sin(radians(cl.lat))
                 ))) END) ASC NULLS LAST,`
            : ""
        } ${locMatchOrder} cl.is_primary DESC, cl.sort_order NULLS LAST, cl.created_at
        LIMIT 1
      ) ploc ON TRUE
      LEFT JOIN clinic_services cs ON cs.clinic_id = c.id AND cs.is_active = TRUE
      LEFT JOIN services s ON s.id = cs.service_id
        AND s.is_active = TRUE
        AND s.name !~* '(dentistry|dental|orthodont|veneer)'
      WHERE ${conditions.join(" AND ")}
        AND ploc.lat IS NOT NULL AND ploc.lng IS NOT NULL
      ORDER BY c.id
      LIMIT 1500
    `;
    const pinsResult = await pool.query(pinsQuery, params);
    const pins = pinsResult.rows.map((r) => ({
      clinic_id: r.clinic_id,
      clinic_slug: r.clinic_slug,
      clinic_name: r.clinic_name,
      lat: r.lat === null ? null : Number(r.lat),
      lng: r.lng === null ? null : Number(r.lng),
      city: r.city,
      state: r.state,
      phone: r.phone,
      website: r.website,
      booking_url: r.booking_url,
      // pg returns numeric columns as strings — coerce to a real number.
      rating:
        r.avg_rating != null
          ? Number(r.avg_rating)
          : r.ext_rating != null
            ? Number(r.ext_rating)
            : null,
      review_count: Number(r.review_count) || 0,
      logo_url: r.logo_url ?? null,
      cover_image_url: r.cover_image_url ?? null,
      featured: r.featured,
    }));
    return { pins };
  }

  // Sort order. Featured clinics are ALWAYS pinned on top; the chosen sort only orders
  // within the featured and non-featured groups. Two variants are needed: `orderBy`
  // (qualified with c.*) for use inside the CTE where the `clinics` alias is in scope,
  // and `outerOrderBy` (bare column names) for the outer SELECT over the CTE's output,
  // where only the CTE's own output columns — not `c` — are visible.
  let orderBy =
    "c.featured DESC, COALESCE(c.avg_rating, c.ext_rating) DESC NULLS LAST, c.review_count DESC";
  let outerOrderBy =
    "featured DESC, COALESCE(avg_rating, ext_rating) DESC NULLS LAST, review_count DESC";
  if (sort === "name") {
    orderBy = "c.featured DESC, c.name ASC";
    outerOrderBy = "featured DESC, clinic_name ASC";
  } else if (sort === "reviews") {
    orderBy = "c.featured DESC, c.review_count DESC NULLS LAST";
    outerOrderBy = "featured DESC, review_count DESC NULLS LAST";
  } else if (sort === "distance" && hasOrigin) {
    orderBy = "c.featured DESC, distance_miles ASC NULLS LAST";
    outerOrderBy = "featured DESC, distance_miles ASC NULLS LAST";
  }

  // First, get the total count with the same conditions
  const simpleCountQuery = `
    SELECT COUNT(*) as total
    FROM (
      SELECT DISTINCT c.id
      FROM clinics c
      LEFT JOIN clinic_services cs ON cs.clinic_id = c.id AND cs.is_active = TRUE
      LEFT JOIN services s ON s.id = cs.service_id
        AND s.is_active = TRUE
        AND s.name !~* '(dentistry|dental|orthodont|veneer)'
      WHERE ${conditions.join(" AND ")}
    ) subq
  `;

  const countResult = await pool.query(simpleCountQuery, params);
  const totalResults = Number(countResult.rows[0]?.total || 0);

  // Now get the paginated results
  const query = `
    WITH ordered_results AS (
      SELECT DISTINCT ON (c.id)
        c.id AS clinic_id,
        ${distanceExpr} AS distance_miles,
        c.name AS clinic_name,
        c.slug AS clinic_slug,
        -- Address/city/state/zip/phone live in clinic_locations now; use the
        -- primary active location (clinic-level address kept as street fallback).
        COALESCE(c.address, ploc.address) AS address,
        ploc.city  AS city,
        ploc.state AS state,
        ploc.zip   AS zip,
        COALESCE(c.phone, ploc.phone) AS phone,
        c.website,
        ploc.lat,
        ploc.lng,
        c.avg_rating,
        c.review_count,
        c.ext_rating,
        c.ext_review_count,
        c.featured,
        c.about,
        c.hours,
        c.booking_url,
        c.google_place_id,
        c.instagram_url,
        (
          SELECT COALESCE(cdn_url, source_url) FROM images
          WHERE entity_type = 'clinic' AND entity_id = c.id
          AND role = 'logo' AND scrape_status = 'ok'
          ORDER BY sort_order LIMIT 1
        ) AS logo_url,
        (
          -- Only canonical-mapped services (skip unmatched scraped nav junk).
          SELECT COALESCE(json_agg(t), '[]'::json) FROM (
          SELECT DISTINCT sv.name AS name, sv.slug AS slug
            FROM clinic_services cs2
            JOIN services sv ON sv.id = cs2.service_id
              AND sv.is_active = TRUE
              AND sv.name !~* '(dentistry|dental|orthodont|veneer)'
            WHERE cs2.clinic_id = c.id AND cs2.is_active = TRUE
            LIMIT 8
          ) t
        ) AS services,
        (
          SELECT COALESCE(cdn_url, source_url) FROM images
          WHERE entity_type = 'clinic' AND entity_id = c.id
          AND role IN ('cover', 'gallery') AND scrape_status = 'ok'
          ORDER BY (role = 'cover') DESC, sort_order LIMIT 1
        ) AS cover_image_url,
        (
          -- Photo strip for the card: cover first, then gallery.
          SELECT COALESCE(json_agg(url ORDER BY ord, so), '[]'::json) FROM (
            SELECT COALESCE(cdn_url, source_url) AS url,
              CASE role WHEN 'cover' THEN 0 ELSE 1 END AS ord,
              sort_order AS so
            FROM images
            WHERE entity_type = 'clinic' AND entity_id = c.id
              AND role IN ('cover', 'gallery')
              AND scrape_status = 'ok'
            ORDER BY ord, so
            LIMIT 12
          ) g
        ) AS gallery_images,
        (
          SELECT count(*)::int FROM clinic_locations cl
          WHERE cl.clinic_id = c.id AND cl.is_active = true
        ) AS location_count,
        '[]'::json AS providers,
        (
          SELECT COALESCE(json_agg(loc ORDER BY loc.sort_order), '[]'::json) FROM (
            SELECT cl.id, cl.label, cl.address, cl.city, cl.state, cl.zip,
                   cl.lat, cl.lng, cl.phone, cl.booking_url, cl.google_maps_url,
                   cl.is_primary, cl.sort_order
            FROM clinic_locations cl
            WHERE cl.clinic_id = c.id AND cl.is_active = true
          ) loc
        ) AS locations
      FROM clinics c
      LEFT JOIN LATERAL (
        SELECT cl.address, cl.city, cl.state, cl.zip, cl.phone, cl.lat, cl.lng
        FROM clinic_locations cl
        WHERE cl.clinic_id = c.id AND cl.is_active = TRUE
        ORDER BY ${
          originLatParam !== null
            ? // With a search origin, show the NEAREST branch's address —
              // "0.3 mi away" next to the primary branch's city reads wrong
              // for multi-location clinics.
              `(CASE WHEN cl.lat IS NULL OR cl.lng IS NULL THEN NULL ELSE
                 3959 * acos(GREATEST(-1, LEAST(1,
                   cos(radians($${originLatParam})) * cos(radians(cl.lat))
                   * cos(radians(cl.lng) - radians($${originLngParam}))
                   + sin(radians($${originLatParam})) * sin(radians(cl.lat))
                 ))) END) ASC NULLS LAST,`
            : ""
        } ${locMatchOrder} cl.is_primary DESC, cl.sort_order NULLS LAST, cl.created_at
        LIMIT 1
      ) ploc ON TRUE
      LEFT JOIN clinic_services cs ON cs.clinic_id = c.id AND cs.is_active = TRUE
      LEFT JOIN services s ON s.id = cs.service_id
        AND s.is_active = TRUE
        AND s.name !~* '(dentistry|dental|orthodont|veneer)'
      WHERE ${conditions.join(" AND ")}
      ORDER BY c.id, ${orderBy}
    )
    SELECT *
    FROM ordered_results
    ORDER BY ${outerOrderBy}
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;

  const queryParams = [...params, limit, offset];

  const result = await pool.query(query, queryParams);

  // Re-sort since DISTINCT ON forces ordering by c.id first.
  // Also round distance_miles to 1 decimal (null when no origin).
  const rows = result.rows;
  for (const row of rows) {
    row.distance_miles =
      row.distance_miles === null || row.distance_miles === undefined
        ? null
        : Math.round(Number(row.distance_miles) * 10) / 10;
  }

  // The results are already sorted by the database query, so we don't need to re-sort in JavaScript

  // Nothing matched here, but the treatment may well exist farther away. Re-run
  // without ANY geographic filter and keep the closest few, so the empty state
  // can say "offered at 6 practices, nearest 87 miles" instead of a dead end.
  // The rating filter is deliberately kept: a user who asked for 4.5+ meant it.
  const nearby = allowRelax
    ? await findNearbyFallback(searchParams, totalResults, q, condition, resolvedLocation)
    : undefined;

  return {
    ...(nearby ? { nearby } : {}),
    results: rows,
    total: totalResults,
    pagination: {
      page,
      limit,
      totalPages: Math.ceil(totalResults / limit),
      hasNext: page < Math.ceil(totalResults / limit),
      hasPrevious: page > 1,
    },
    query: {
      q: qRaw,
      condition,
      /** What `q` resolved to — null when it named nothing in the catalog. */
      resolved:
        resolvedQuery.kind === "unresolved"
          ? null
          : { kind: resolvedQuery.kind, slug: resolvedQuery.slug, name: resolvedQuery.name },
      location,
      sort,
      tier,
      lat: hasOrigin ? latNum : null,
      lng: hasOrigin ? lngNum : null,
      radius: hasOrigin ? radiusNum : null,
      rating: ratingNum,
    },
  };
}

/**
 * After a zero-result search, look for the same treatment/condition with the
 * geography dropped. Returns undefined when there was no geographic filter to
 * relax, nothing was searched for, or the relaxed search is also empty.
 */
async function findNearbyFallback(
  searchParams: URLSearchParams,
  totalResults: number,
  q: string,
  condition: string,
  resolvedLocation: ReturnType<typeof resolveLocationScope>,
): Promise<NearbyFallback | undefined> {
  if (totalResults > 0 || (!q && !condition)) return undefined;

  const { scope } = resolvedLocation;
  if (scope.kind === "national") return undefined; // nothing to relax

  const relaxed = new URLSearchParams(searchParams);
  relaxed.delete("location");
  relaxed.delete("radius");
  relaxed.delete("pins");
  relaxed.set("page", "1");
  relaxed.set("limit", String(NEARBY_LIMIT));
  // With `location` gone, an origin survives only as explicit lat/lng — which
  // no longer triggers the radius filter, so it just sorts by distance.
  relaxed.set("sort", resolvedLocation.origin ? "distance" : "rating");
  if (resolvedLocation.origin) {
    relaxed.set("lat", String(resolvedLocation.origin.lat));
    relaxed.set("lng", String(resolvedLocation.origin.lng));
  }

  const retry = (await runSearch(relaxed, false)) as SearchListResponse;
  if (retry.total === 0) return undefined;

  const nearest = retry.results[0]?.distance_miles;
  return {
    results: retry.results,
    total: retry.total,
    nearestMiles: typeof nearest === "number" ? nearest : null,
    relaxedFrom: {
      kind: scope.kind === "origin" ? "radius" : scope.kind,
      radiusMiles: scope.kind === "origin" ? scope.radiusMiles : null,
      // Full state name reads better than the abbreviation the URL carries.
      location: scope.kind === "state" ? scope.fullName : searchParams.get("location") || "",
    },
  };
}

/** How many farther-away practices to surface under an empty result set. */
const NEARBY_LIMIT = 6;

/**
 * List-mode wrapper for server components that render the first result page.
 * Never requests `?pins`, so the payload is always the list shape.
 */
export async function searchClinics(
  searchParams: URLSearchParams,
): Promise<SearchListResponse> {
  return (await runSearch(searchParams)) as SearchListResponse;
}
