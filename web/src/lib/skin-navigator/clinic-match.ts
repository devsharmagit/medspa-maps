import pool from "@/lib/db";
import { lookupCityState, lookupZip } from "@/lib/location/postal-index";
import { toStateCode, toStateName } from "@/lib/location/states";
import type {
  NavigatorAnalysis,
  NavigatorClinicMatch,
  NavigatorRequest,
} from "./schema";

interface Origin {
  lat: number;
  lng: number;
}

interface LocationScope {
  origin: Origin | null;
  stateCode: string | null;
  stateName: string | null;
  text: string | null;
}

interface ServiceWeight {
  slug: string;
  weight: number;
}

interface ClinicMatchRow {
  clinic_id: string;
  clinic_name: string;
  clinic_slug: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  avg_rating: string | number | null;
  review_count: string | number | null;
  ext_rating: string | number | null;
  ext_review_count: string | number | null;
  cover_image_url: string | null;
  logo_url: string | null;
  distance_miles: string | number | null;
  best_service_weight: string | number | null;
  matched_treatments: unknown;
}

function resolveLocationScope(request: NavigatorRequest): LocationScope {
  const loc = request.basics.location;
  const value = loc.value.trim();

  if (
    typeof loc.lat === "number" &&
    typeof loc.lng === "number" &&
    Number.isFinite(loc.lat) &&
    Number.isFinite(loc.lng)
  ) {
    const stateFromLabel = loc.value.match(/,\s*([A-Za-z]{2})$/);
    const stateCode = toStateCode(stateFromLabel?.[1] ?? null);
    return {
      origin: { lat: loc.lat, lng: loc.lng },
      stateCode,
      stateName: stateCode ? toStateName(stateCode) : null,
      text: null,
    };
  }

  const zipOnly = value.match(/^(\d{5})$/);
  if (zipOnly) {
    const hit = lookupZip(zipOnly[1]);
    return hit
      ? {
          origin: { lat: hit.lat, lng: hit.lng },
          stateCode: hit.state_code,
          stateName: hit.state_name,
          text: null,
        }
      : { origin: null, stateCode: null, stateName: null, text: value };
  }

  const cityState = value.match(/^(.+?)\s*,\s*([A-Za-z .]{2,})$/);
  if (cityState) {
    const hit = lookupCityState(cityState[1], cityState[2]);
    if (hit) {
      return {
        origin: { lat: hit.lat, lng: hit.lng },
        stateCode: hit.state_code,
        stateName: hit.state_name,
        text: null,
      };
    }
  }

  const stateCode = toStateCode(value);
  if (stateCode) {
    return {
      origin: null,
      stateCode,
      stateName: toStateName(stateCode),
      text: null,
    };
  }

  return { origin: null, stateCode: null, stateName: null, text: value || null };
}

function treatmentWeights(analysis: NavigatorAnalysis): ServiceWeight[] {
  const weights = new Map<string, number>();
  for (const treatment of analysis.recommendedTreatments) {
    const weight =
      treatment.priority === "primary"
        ? 100
        : treatment.priority === "secondary"
          ? 78
          : 58;
    weights.set(treatment.slug, Math.max(weights.get(treatment.slug) ?? 0, weight));
  }
  for (const alt of analysis.alternatives) {
    weights.set(alt.slug, Math.max(weights.get(alt.slug) ?? 0, 40));
  }
  return [...weights.entries()].map(([slug, weight]) => ({ slug, weight }));
}

async function validServiceWeights(weights: ServiceWeight[]): Promise<ServiceWeight[]> {
  if (weights.length === 0) return [];
  const { rows } = await pool.query<{ slug: string }>(
    `SELECT slug
     FROM services
     WHERE slug = ANY($1::text[])
       AND is_active = true
       AND name !~* '(dentistry|dental|orthodont|veneer)'`,
    [weights.map((w) => w.slug)]
  );
  const valid = new Set(rows.map((r) => r.slug));
  return weights.filter((w) => valid.has(w.slug));
}

function scoreClinic(row: {
  best_service_weight?: number | string | null;
  distance_miles?: number | string | null;
  avg_rating?: number | string | null;
  ext_rating?: number | string | null;
  review_count?: number | string | null;
  ext_review_count?: number | string | null;
}, hasOrigin: boolean): number {
  const serviceWeight = Number(row.best_service_weight ?? 0);
  const treatmentScore = Math.min(45, (serviceWeight / 100) * 45);

  const distance = row.distance_miles == null ? null : Number(row.distance_miles);
  const distanceScore =
    hasOrigin && distance !== null && Number.isFinite(distance)
      ? Math.max(0, 1 - Math.min(distance, 50) / 50) * 25
      : 0;

  const rating = Number(row.avg_rating ?? row.ext_rating ?? 0);
  const ratingScore = Math.min(15, Math.max(0, rating / 5) * 15);
  const reviewCount = Number(row.review_count ?? row.ext_review_count ?? 0);
  const reviewScore = Math.min(5, Math.log10(reviewCount + 1) * 1.7);

  return Math.round((treatmentScore + distanceScore + ratingScore + reviewScore) * 10) / 10;
}

function mapClinicRow(row: ClinicMatchRow, hasOrigin: boolean): NavigatorClinicMatch {
  const distance =
    row.distance_miles === null || row.distance_miles === undefined
      ? null
      : Math.round(Number(row.distance_miles) * 10) / 10;
  const ratingRaw = row.avg_rating ?? row.ext_rating;
  const rating =
    ratingRaw === null || ratingRaw === undefined
      ? null
      : Math.round(Number(ratingRaw) * 10) / 10;
  const matchedTreatments = Array.isArray(row.matched_treatments)
    ? row.matched_treatments.filter(
        (item): item is { name: string; slug: string } =>
          typeof item === "object" &&
          item !== null &&
          "name" in item &&
          "slug" in item &&
          typeof item.name === "string" &&
          typeof item.slug === "string"
      )
    : [];

  return {
    clinicId: row.clinic_id,
    name: row.clinic_name,
    slug: row.clinic_slug,
    profileUrl: `/clinics/${row.clinic_slug}`,
    distanceMiles: distance,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    rating,
    reviewCount: Number(row.review_count ?? row.ext_review_count ?? 0),
    verified: false,
    coverImageUrl: row.cover_image_url,
    logoUrl: row.logo_url,
    matchedTreatments,
    matchScore: scoreClinic(row, hasOrigin),
  };
}

async function matchByTreatments(
  weights: ServiceWeight[],
  location: LocationScope
): Promise<NavigatorClinicMatch[]> {
  if (weights.length === 0) return [];
  const slugs = weights.map((w) => w.slug);
  const weightValues = weights.map((w) => w.weight);
  const hasOrigin = Boolean(location.origin);
  const params: unknown[] = [slugs, weightValues];
  let distanceExpr = "NULL::float";
  let nearestOrder = "cl.is_primary DESC, cl.sort_order NULLS LAST, cl.created_at";
  const filters: string[] = ["c.is_active = true"];
  if (location.origin) {
    params.push(location.origin.lat, location.origin.lng);
    const latParam = params.length - 1;
    const lngParam = params.length;
    distanceExpr = `(
      SELECT MIN(
        3959 * acos(
          GREATEST(-1, LEAST(1,
            cos(radians($${latParam})) * cos(radians(pt.lat))
            * cos(radians(pt.lng) - radians($${lngParam}))
            + sin(radians($${latParam})) * sin(radians(pt.lat))
          ))
        )
      )
      FROM (
        SELECT cl2.lat::float AS lat, cl2.lng::float AS lng
        FROM clinic_locations cl2
        WHERE cl2.clinic_id = c.id AND cl2.is_active = true
          AND cl2.lat IS NOT NULL AND cl2.lng IS NOT NULL
      ) pt
    )`;
    filters.push(`${distanceExpr} <= 80`);
    nearestOrder = `(CASE WHEN cl.lat IS NULL OR cl.lng IS NULL THEN NULL ELSE
      3959 * acos(GREATEST(-1, LEAST(1,
        cos(radians($${latParam})) * cos(radians(cl.lat))
        * cos(radians(cl.lng) - radians($${lngParam}))
        + sin(radians($${latParam})) * sin(radians(cl.lat))
      ))) END) ASC NULLS LAST, cl.is_primary DESC, cl.sort_order NULLS LAST, cl.created_at`;
  } else if (location.stateCode && location.stateName) {
    params.push(location.stateCode, location.stateName);
    const codeParam = params.length - 1;
    const nameParam = params.length;
    filters.push(`(
      EXISTS (
        SELECT 1 FROM clinic_locations cl_state
        WHERE cl_state.clinic_id = c.id AND cl_state.is_active = true
          AND (cl_state.state = $${codeParam} OR cl_state.state ILIKE $${nameParam})
      )
    )`);
  } else if (location.text) {
    params.push(`%${location.text}%`);
    const textParam = params.length;
    filters.push(`(
      EXISTS (
        SELECT 1 FROM clinic_locations cl_text
        WHERE cl_text.clinic_id = c.id AND cl_text.is_active = true
          AND (
            cl_text.city ILIKE $${textParam}
            OR cl_text.state ILIKE $${textParam}
            OR cl_text.zip ILIKE $${textParam}
          )
      )
    )`);
  }

  const { rows } = await pool.query(
    `
    WITH requested AS (
      SELECT slug, weight
      FROM unnest($1::text[], $2::int[]) AS r(slug, weight)
    )
    SELECT
      c.id AS clinic_id,
      c.name AS clinic_name,
      c.slug AS clinic_slug,
      COALESCE(c.address, ploc.address) AS address,
      ploc.city AS city,
      ploc.state AS state,
      ploc.zip AS zip,
      c.avg_rating,
      c.review_count,
      c.ext_rating,
      c.ext_review_count,
      (
        SELECT COALESCE(i.cdn_url, i.source_url)
        FROM images i
        WHERE i.entity_type = 'clinic'
          AND i.entity_id = c.id
          AND i.role IN ('cover', 'gallery')
          AND i.scrape_status = 'ok'
        ORDER BY (i.role = 'cover') DESC, i.sort_order
        LIMIT 1
      ) AS cover_image_url,
      (
        SELECT COALESCE(i.cdn_url, i.source_url)
        FROM images i
        WHERE i.entity_type = 'clinic'
          AND i.entity_id = c.id
          AND i.role = 'logo'
          AND i.scrape_status = 'ok'
        ORDER BY i.sort_order
        LIMIT 1
      ) AS logo_url,
      ${distanceExpr} AS distance_miles,
      MAX(requested.weight) AS best_service_weight,
      COALESCE(
        jsonb_agg(DISTINCT jsonb_build_object('name', s.name, 'slug', s.slug))
          FILTER (WHERE s.slug IS NOT NULL),
        '[]'::jsonb
      ) AS matched_treatments
    FROM clinics c
    JOIN clinic_services cs ON cs.clinic_id = c.id AND cs.is_active = true
    JOIN services s ON s.id = cs.service_id
      AND s.is_active = true
      AND s.name !~* '(dentistry|dental|orthodont|veneer)'
    JOIN requested ON requested.slug = s.slug
    LEFT JOIN LATERAL (
      SELECT cl.address, cl.city, cl.state, cl.zip
      FROM clinic_locations cl
      WHERE cl.clinic_id = c.id AND cl.is_active = true
      ORDER BY ${nearestOrder}
      LIMIT 1
    ) ploc ON true
    WHERE ${filters.join(" AND ")}
    GROUP BY c.id, ploc.address, ploc.city, ploc.state, ploc.zip
    LIMIT 80
    `,
    params
  );

  return rows
    .map((row) => mapClinicRow(row, hasOrigin))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 12);
}

async function matchByConcerns(
  analysis: NavigatorAnalysis,
  location: LocationScope
): Promise<NavigatorClinicMatch[]> {
  const concernSlugs = [...new Set(analysis.concerns.map((c) => c.slug))];
  if (concernSlugs.length === 0) return [];
  const hasOrigin = Boolean(location.origin);
  const params: unknown[] = [concernSlugs];
  let distanceExpr = "NULL::float";
  let nearestOrder = "cl.is_primary DESC, cl.sort_order NULLS LAST, cl.created_at";
  const filters: string[] = ["c.is_active = true"];
  if (location.origin) {
    params.push(location.origin.lat, location.origin.lng);
    const latParam = params.length - 1;
    const lngParam = params.length;
    distanceExpr = `(
      SELECT MIN(
        3959 * acos(GREATEST(-1, LEAST(1,
          cos(radians($${latParam})) * cos(radians(pt.lat))
          * cos(radians(pt.lng) - radians($${lngParam}))
          + sin(radians($${latParam})) * sin(radians(pt.lat))
        )))
      )
      FROM (
        SELECT cl2.lat::float AS lat, cl2.lng::float AS lng
        FROM clinic_locations cl2
        WHERE cl2.clinic_id = c.id AND cl2.is_active = true
          AND cl2.lat IS NOT NULL AND cl2.lng IS NOT NULL
      ) pt
    )`;
    filters.push(`${distanceExpr} <= 80`);
    nearestOrder = `(CASE WHEN cl.lat IS NULL OR cl.lng IS NULL THEN NULL ELSE
      3959 * acos(GREATEST(-1, LEAST(1,
        cos(radians($${latParam})) * cos(radians(cl.lat))
        * cos(radians(cl.lng) - radians($${lngParam}))
        + sin(radians($${latParam})) * sin(radians(cl.lat))
      ))) END) ASC NULLS LAST, cl.is_primary DESC, cl.sort_order NULLS LAST, cl.created_at`;
  } else if (location.stateCode && location.stateName) {
    params.push(location.stateCode, location.stateName);
    const codeParam = params.length - 1;
    const nameParam = params.length;
    filters.push(`(
      EXISTS (
        SELECT 1 FROM clinic_locations cl_state
        WHERE cl_state.clinic_id = c.id AND cl_state.is_active = true
          AND (cl_state.state = $${codeParam} OR cl_state.state ILIKE $${nameParam})
      )
    )`);
  } else if (location.text) {
    params.push(`%${location.text}%`);
    const textParam = params.length;
    filters.push(`(
      EXISTS (
        SELECT 1 FROM clinic_locations cl_text
        WHERE cl_text.clinic_id = c.id AND cl_text.is_active = true
          AND (
            cl_text.city ILIKE $${textParam}
            OR cl_text.state ILIKE $${textParam}
            OR cl_text.zip ILIKE $${textParam}
          )
      )
    )`);
  }

  const { rows } = await pool.query(
    `
    SELECT
      c.id AS clinic_id,
      c.name AS clinic_name,
      c.slug AS clinic_slug,
      COALESCE(c.address, ploc.address) AS address,
      ploc.city AS city,
      ploc.state AS state,
      ploc.zip AS zip,
      c.avg_rating,
      c.review_count,
      c.ext_rating,
      c.ext_review_count,
      (
        SELECT COALESCE(i.cdn_url, i.source_url)
        FROM images i
        WHERE i.entity_type = 'clinic'
          AND i.entity_id = c.id
          AND i.role IN ('cover', 'gallery')
          AND i.scrape_status = 'ok'
        ORDER BY (i.role = 'cover') DESC, i.sort_order
        LIMIT 1
      ) AS cover_image_url,
      (
        SELECT COALESCE(i.cdn_url, i.source_url)
        FROM images i
        WHERE i.entity_type = 'clinic'
          AND i.entity_id = c.id
          AND i.role = 'logo'
          AND i.scrape_status = 'ok'
        ORDER BY i.sort_order
        LIMIT 1
      ) AS logo_url,
      ${distanceExpr} AS distance_miles,
      55 AS best_service_weight,
      COALESCE(
        (
          SELECT jsonb_agg(DISTINCT jsonb_build_object('name', s.name, 'slug', s.slug))
          FROM clinic_services cs
          JOIN services s ON s.id = cs.service_id
            AND s.is_active = true
            AND s.name !~* '(dentistry|dental|orthodont|veneer)'
          WHERE cs.clinic_id = c.id AND cs.is_active = true
          LIMIT 5
        ),
        '[]'::jsonb
      ) AS matched_treatments
    FROM clinics c
    LEFT JOIN LATERAL (
      SELECT cl.address, cl.city, cl.state, cl.zip
      FROM clinic_locations cl
      WHERE cl.clinic_id = c.id AND cl.is_active = true
      ORDER BY ${nearestOrder}
      LIMIT 1
    ) ploc ON true
    WHERE ${filters.join(" AND ")}
      AND EXISTS (
        SELECT 1
        FROM clinic_concerns cc
        JOIN concerns con ON con.id = cc.concern_id
        WHERE cc.clinic_id = c.id
          AND cc.is_active = true
          AND cc.source IN ('scraped', 'manual')
          AND con.is_active = true
          AND con.slug = ANY($1::text[])
      )
      AND NOT EXISTS (
        SELECT 1
        FROM clinic_concerns cc2
        JOIN concerns con2 ON con2.id = cc2.concern_id
        WHERE cc2.clinic_id = c.id
          AND cc2.is_active = true
          AND cc2.source = 'removed'
          AND con2.slug = ANY($1::text[])
      )
    LIMIT 80
    `,
    params
  );

  return rows
    .map((row) => mapClinicRow(row, hasOrigin))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 12);
}

/**
 * Final fallback: real medspas NEAR the user's location, regardless of whether
 * they carry the exact (often niche) treatment/concern slugs the AI picked. The
 * AI recommends specific brand/technique slugs that few clinics list verbatim, so
 * the strict passes above frequently return nothing even when good local clinics
 * exist. This keeps the results useful. `preferred` weights only decorate the
 * card's matchedTreatments (overlap) — they are not required.
 */
async function matchNearbyClinics(
  preferred: ServiceWeight[],
  location: LocationScope
): Promise<NavigatorClinicMatch[]> {
  const slugs = preferred.map((w) => w.slug);
  const weightValues = preferred.map((w) => w.weight);
  const hasOrigin = Boolean(location.origin);
  const params: unknown[] = [slugs, weightValues];
  let distanceExpr = "NULL::float";
  let nearestOrder = "cl.is_primary DESC, cl.sort_order NULLS LAST, cl.created_at";
  const filters: string[] = ["c.is_active = true"];
  if (location.origin) {
    params.push(location.origin.lat, location.origin.lng);
    const latParam = params.length - 1;
    const lngParam = params.length;
    distanceExpr = `(
      SELECT MIN(3959 * acos(GREATEST(-1, LEAST(1,
        cos(radians($${latParam})) * cos(radians(pt.lat))
        * cos(radians(pt.lng) - radians($${lngParam}))
        + sin(radians($${latParam})) * sin(radians(pt.lat))
      ))))
      FROM (
        SELECT cl2.lat::float AS lat, cl2.lng::float AS lng
        FROM clinic_locations cl2
        WHERE cl2.clinic_id = c.id AND cl2.is_active = true
          AND cl2.lat IS NOT NULL AND cl2.lng IS NOT NULL
      ) pt
    )`;
    filters.push(`${distanceExpr} <= 80`);
    nearestOrder = `(CASE WHEN cl.lat IS NULL OR cl.lng IS NULL THEN NULL ELSE
      3959 * acos(GREATEST(-1, LEAST(1,
        cos(radians($${latParam})) * cos(radians(cl.lat))
        * cos(radians(cl.lng) - radians($${lngParam}))
        + sin(radians($${latParam})) * sin(radians(cl.lat))
      ))) END) ASC NULLS LAST, cl.is_primary DESC, cl.sort_order NULLS LAST, cl.created_at`;
  } else if (location.stateCode && location.stateName) {
    params.push(location.stateCode, location.stateName);
    const codeParam = params.length - 1;
    const nameParam = params.length;
    filters.push(`EXISTS (
      SELECT 1 FROM clinic_locations cl_state
      WHERE cl_state.clinic_id = c.id AND cl_state.is_active = true
        AND (cl_state.state = $${codeParam} OR cl_state.state ILIKE $${nameParam})
    )`);
  } else if (location.text) {
    params.push(`%${location.text}%`);
    const textParam = params.length;
    filters.push(`EXISTS (
      SELECT 1 FROM clinic_locations cl_text
      WHERE cl_text.clinic_id = c.id AND cl_text.is_active = true
        AND (cl_text.city ILIKE $${textParam} OR cl_text.state ILIKE $${textParam} OR cl_text.zip ILIKE $${textParam})
    )`);
  } else {
    // No usable location at all → don't return random clinics.
    return [];
  }

  const { rows } = await pool.query(
    `
    WITH requested AS (
      SELECT slug, weight FROM unnest($1::text[], $2::int[]) AS r(slug, weight)
    )
    SELECT
      c.id AS clinic_id, c.name AS clinic_name, c.slug AS clinic_slug,
      COALESCE(c.address, ploc.address) AS address,
      ploc.city AS city, ploc.state AS state, ploc.zip AS zip,
      c.avg_rating, c.review_count, c.ext_rating, c.ext_review_count,
      (SELECT COALESCE(i.cdn_url, i.source_url) FROM images i
        WHERE i.entity_type = 'clinic' AND i.entity_id = c.id
          AND i.role IN ('cover','gallery') AND i.scrape_status = 'ok'
        ORDER BY (i.role = 'cover') DESC, i.sort_order LIMIT 1) AS cover_image_url,
      (SELECT COALESCE(i.cdn_url, i.source_url) FROM images i
        WHERE i.entity_type = 'clinic' AND i.entity_id = c.id
          AND i.role = 'logo' AND i.scrape_status = 'ok'
        ORDER BY i.sort_order LIMIT 1) AS logo_url,
      ${distanceExpr} AS distance_miles,
      COALESCE(MAX(req.weight), 0) AS best_service_weight,
      COALESCE(
        jsonb_agg(DISTINCT jsonb_build_object('name', s.name, 'slug', s.slug))
          FILTER (WHERE req.slug IS NOT NULL),
        '[]'::jsonb
      ) AS matched_treatments
    FROM clinics c
    JOIN clinic_services cs ON cs.clinic_id = c.id AND cs.is_active = true
    JOIN services s ON s.id = cs.service_id AND s.is_active = true
      AND s.name !~* '(dentistry|dental|orthodont|veneer)'
    LEFT JOIN requested req ON req.slug = s.slug
    LEFT JOIN LATERAL (
      SELECT cl.address, cl.city, cl.state, cl.zip
      FROM clinic_locations cl
      WHERE cl.clinic_id = c.id AND cl.is_active = true
      ORDER BY ${nearestOrder}
      LIMIT 1
    ) ploc ON true
    WHERE ${filters.join(" AND ")}
    GROUP BY c.id, ploc.address, ploc.city, ploc.state, ploc.zip
    LIMIT 80
    `,
    params
  );

  return rows
    .map((row) => mapClinicRow(row as ClinicMatchRow, hasOrigin))
    .sort((a, b) => {
      // nearest first when we have coordinates, else rating/reviews
      if (hasOrigin && a.distanceMiles != null && b.distanceMiles != null) {
        if (a.distanceMiles !== b.distanceMiles) return a.distanceMiles - b.distanceMiles;
      }
      if ((b.rating ?? 0) !== (a.rating ?? 0)) return (b.rating ?? 0) - (a.rating ?? 0);
      return b.reviewCount - a.reviewCount;
    })
    .slice(0, 12);
}

export async function matchNavigatorClinics(
  request: NavigatorRequest,
  analysis: NavigatorAnalysis
): Promise<NavigatorClinicMatch[]> {
  const location = resolveLocationScope(request);
  const weights = await validServiceWeights(treatmentWeights(analysis));
  const treatmentMatches = await matchByTreatments(weights, location);
  if (treatmentMatches.length > 0) return treatmentMatches;
  const concernMatches = await matchByConcerns(analysis, location);
  if (concernMatches.length > 0) return concernMatches;
  // Last resort: relevant medspas near the user so results are never empty.
  return matchNearbyClinics(weights, location);
}
