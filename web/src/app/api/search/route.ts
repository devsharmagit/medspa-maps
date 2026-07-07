import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { lookupZip, lookupCityState } from "@/lib/location/postal-index";

// Maps 2-letter state abbreviations to full names as stored in the DB
const STATE_ABBR_TO_NAME: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};

// Reverse: FULL STATE NAME (upper-cased) → 2-letter abbreviation. Lets the
// location search resolve a typed full name ("California") the same as "CA".
const STATE_NAME_TO_ABBR: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_ABBR_TO_NAME).map(([abbr, name]) => [name.toUpperCase(), abbr])
);

/**
 * Resolve a typed location string to coordinates using the in-memory postal
 * index (src/data/postal-codes-us.json — no DB round-trip). Handles "37203"
 * (zip) and "Nashville, TN" (city, state). Plain city names stay on the
 * text-match path — the typeahead UI sends lat/lng when a suggestion is picked.
 */
function resolveTypedLocation(
  location: string,
): { lat: number; lng: number } | null {
  const zipMatch = location.match(/^\s*(\d{5})\s*$/);
  if (zipMatch) {
    const hit = lookupZip(zipMatch[1]);
    return hit ? { lat: hit.lat, lng: hit.lng } : null;
  }

  // "City, ST" / "City, StateName" — specific enough to geocode locally.
  const cityState = location.match(/^\s*(.+?)\s*,\s*([A-Za-z .]{2,})\s*$/);
  if (cityState) {
    const hit = lookupCityState(cityState[1], cityState[2]);
    if (hit) return { lat: hit.lat, lng: hit.lng };
  }
  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q") || "";
  const location = searchParams.get("location") || "";
  const tier = searchParams.get("tier") || "";

  // Geo / rating params
  const latRaw = searchParams.get("lat");
  const lngRaw = searchParams.get("lng");
  const radiusRaw = searchParams.get("radius");
  const ratingRaw = searchParams.get("rating");

  let latNum = latRaw !== null ? Number(latRaw) : NaN;
  let lngNum = lngRaw !== null ? Number(lngRaw) : NaN;
  let hasOrigin = Number.isFinite(latNum) && Number.isFinite(lngNum);

  // Ecommerce-style zip/area search: a location of the form "37201" or
  // "Nashville, TN" is geo-resolvable, so distance handles it — the text
  // filter must NOT also run ("Nashville, TN" never ILIKE-matches the city
  // column "Nashville", and "37201" would exclude the clinic one zip over).
  // When the client sent no coordinates (raw typed input), we also resolve
  // the origin from the in-memory postal index here.
  const typedGeo = location ? resolveTypedLocation(location) : null;
  const originFromTypedLocation = Boolean(typedGeo);
  if (!hasOrigin && typedGeo) {
    latNum = typedGeo.lat;
    lngNum = typedGeo.lng;
    hasOrigin = true;
  }

  const radiusNum = radiusRaw !== null && Number.isFinite(Number(radiusRaw))
    ? Number(radiusRaw)
    : 25; // miles, default 25

  const ratingNum = ratingRaw !== null && Number.isFinite(Number(ratingRaw))
    ? Number(ratingRaw)
    : null;

  // Default sort is 'distance' when an origin is present, else 'rating'
  const sort = searchParams.get("sort") || (hasOrigin ? "distance" : "rating"); // distance | rating | name | reviews

  try {
    const conditions: string[] = ["c.is_active = TRUE", "b.is_active = TRUE"];
    const params: (string | number)[] = [];
    let paramIdx = 1;

    // Haversine distance in MILES from (lat,lng) origin, computed in SQL.
    // Distance = NEAREST point among the clinic's own coords AND all of its
    // active clinic_locations. This makes distance work for clinics whose
    // primary coords live only in clinic_locations (the common case after
    // import) and gives multi-location clinics the honest "closest branch".
    let distanceExpr = "NULL::float";
    let originLatParam: number | null = null;
    let originLngParam: number | null = null;
    if (hasOrigin) {
      const latParam = paramIdx;
      const lngParam = paramIdx + 1;
      originLatParam = latParam;
      originLngParam = lngParam;
      // 3959 = Earth radius in miles. GREATEST/LEAST clamp acos domain errors.
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
          SELECT c.lat::float AS lat, c.lng::float AS lng
          WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL
          UNION ALL
          SELECT cl2.lat::float, cl2.lng::float
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

    // Service / treatment search — checks canonical services AND raw scraped names
    if (q) {
      conditions.push(`(
        s.name ILIKE $${paramIdx}
        OR s.slug = $${paramIdx + 1}
        OR s.category ILIKE $${paramIdx}
        OR cs.raw_name ILIKE $${paramIdx}
        OR c.name ILIKE $${paramIdx}
        OR b.name ILIKE $${paramIdx}
      )`);
      params.push(`%${q}%`, q);
      paramIdx += 2;
    }

    // Location search — checks both clinics table AND clinic_locations for
    // multi-location clinics. Skipped when the typed location was resolved to
    // an origin (zip / "City, ST"): distance handles it, and a string match on
    // "37201" would wrongly exclude the clinic one zip over.
    if (location && !originFromTypedLocation) {
      const upper = location.trim().toUpperCase();
      // Resolve either a 2-letter abbr ("CA") or a full name ("California") → abbr.
      const abbr = STATE_ABBR_TO_NAME[upper] ? upper : STATE_NAME_TO_ABBR[upper];
      const fullName = abbr ? STATE_ABBR_TO_NAME[abbr] : undefined;
      if (abbr && fullName) {
        conditions.push(`(
          c.state = $${paramIdx} OR c.state ILIKE $${paramIdx + 1}
          OR EXISTS (
            SELECT 1 FROM clinic_locations cl
            WHERE cl.clinic_id = c.id AND cl.is_active = true
              AND (cl.state = $${paramIdx} OR cl.state ILIKE $${paramIdx + 1})
          )
        )`);
        params.push(abbr, fullName);
        paramIdx += 2;
      } else {
        conditions.push(`(
          c.city ILIKE $${paramIdx}
          OR c.state ILIKE $${paramIdx}
          OR c.zip ILIKE $${paramIdx}
          OR EXISTS (
            SELECT 1 FROM clinic_locations cl
            WHERE cl.clinic_id = c.id AND cl.is_active = true
              AND (cl.city ILIKE $${paramIdx} OR cl.state ILIKE $${paramIdx} OR cl.zip ILIKE $${paramIdx})
          )
        )`);
        params.push(`%${location}%`);
        paramIdx++;
      }
    }

    // Tier filter
    if (tier && ["free", "featured", "elite"].includes(tier)) {
      conditions.push(`c.tier = $${paramIdx}`);
      params.push(tier);
      paramIdx++;
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
    const explicitRadius = radiusRaw !== null && Number.isFinite(Number(radiusRaw));
    if (hasOrigin && (explicitRadius || originFromTypedLocation)) {
      conditions.push(`${distanceExpr} <= $${paramIdx}`);
      params.push(explicitRadius ? radiusNum : 50);
      paramIdx++;
    }

    // Sort order. DISTINCT ON (c.id) requires c.id to lead the ORDER BY, so the
    // per-clinic tie-break ordering follows it here and JS re-sorts afterwards.
    // Featured clinics are ALWAYS pinned on top; the chosen sort only orders
    // within the featured and non-featured groups.
    let orderBy =
      "c.featured DESC, COALESCE(c.avg_rating, c.ext_rating) DESC NULLS LAST, c.review_count DESC";
    if (sort === "name") orderBy = "c.featured DESC, c.name ASC";
    else if (sort === "reviews") orderBy = "c.featured DESC, c.review_count DESC NULLS LAST";
    else if (sort === "distance" && hasOrigin) orderBy = "c.featured DESC, distance_miles ASC NULLS LAST";

    const query = `
      SELECT DISTINCT ON (c.id)
        c.id AS clinic_id,
        ${distanceExpr} AS distance_miles,
        c.name AS clinic_name,
        c.slug AS clinic_slug,
        -- Address/city/state/zip/phone: the clinics columns are often NULL
        -- (imported data lives in clinic_locations) — fall back to the primary
        -- active location so cards always have a display address.
        COALESCE(c.address, ploc.address) AS address,
        COALESCE(c.city,    ploc.city)    AS city,
        COALESCE(c.state,   ploc.state)   AS state,
        COALESCE(c.zip,     ploc.zip)     AS zip,
        COALESCE(c.phone,   ploc.phone)   AS phone,
        c.website,
        c.lat,
        c.lng,
        c.avg_rating,
        c.review_count,
        c.ext_rating,
        c.ext_review_count,
        c.featured,
        c.tier,
        c.verified,
        c.about,
        c.hours,
        c.booking_url,
        c.google_place_id,
        c.instagram_url,
        b.id AS business_id,
        b.name AS business_name,
        (
          SELECT source_url FROM images
          WHERE entity_type = 'business' AND entity_id = b.id
          AND role = 'logo' AND scrape_status = 'ok'
          ORDER BY sort_order LIMIT 1
        ) AS logo_url,
        (
          -- Only canonical-mapped services (skip unmatched scraped nav junk).
          SELECT COALESCE(json_agg(t), '[]'::json) FROM (
            SELECT DISTINCT sv.name AS name, sv.slug AS slug
            FROM clinic_services cs2
            JOIN services sv ON sv.id = cs2.service_id AND sv.is_active = TRUE
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
          -- Photo strip for the card: cover first, then gallery, then before/after.
          SELECT COALESCE(json_agg(url ORDER BY ord, so), '[]'::json) FROM (
            SELECT COALESCE(cdn_url, source_url) AS url,
              CASE role WHEN 'cover' THEN 0 WHEN 'gallery' THEN 1 ELSE 2 END AS ord,
              sort_order AS so
            FROM images
            WHERE entity_type = 'clinic' AND entity_id = c.id
              AND role IN ('cover', 'gallery', 'before_after')
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
      JOIN businesses b ON b.id = c.business_id
      LEFT JOIN LATERAL (
        SELECT cl.address, cl.city, cl.state, cl.zip, cl.phone
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
        } cl.is_primary DESC, cl.sort_order NULLS LAST, cl.created_at
        LIMIT 1
      ) ploc ON TRUE
      LEFT JOIN clinic_services cs ON cs.clinic_id = c.id AND cs.is_active = TRUE
      LEFT JOIN services s ON s.id = cs.service_id AND s.is_active = TRUE
      WHERE ${conditions.join(" AND ")}
      ORDER BY c.id, ${orderBy}
      LIMIT 50
    `;

    const result = await pool.query(query, params);

    // Re-sort since DISTINCT ON forces ordering by c.id first.
    // Also round distance_miles to 1 decimal (null when no origin).
    const rows = result.rows;
    for (const row of rows) {
      row.distance_miles =
        row.distance_miles === null || row.distance_miles === undefined
          ? null
          : Math.round(Number(row.distance_miles) * 10) / 10;
    }

    // Rating for display/sort: internal average, falling back to external/Google.
    const ratingOf = (r: { avg_rating: unknown; ext_rating: unknown }) =>
      Number(r.avg_rating ?? r.ext_rating ?? 0);

    rows.sort((a, b) => {
      // Featured clinics are ALWAYS on top, regardless of the chosen sort.
      if (a.featured !== b.featured) return a.featured ? -1 : 1;

      // Then order within each group by the selected sort.
      if (sort === "distance" && hasOrigin) {
        const da = a.distance_miles ?? Infinity;
        const db = b.distance_miles ?? Infinity;
        if (da !== db) return da - db;
        return ratingOf(b) - ratingOf(a);
      }
      if (sort === "name") return a.clinic_name.localeCompare(b.clinic_name);
      if (sort === "reviews") return (b.review_count || 0) - (a.review_count || 0);

      // Default: rating (internal → external), then review volume.
      const byRating = ratingOf(b) - ratingOf(a);
      if (byRating !== 0) return byRating;
      return (b.review_count || 0) - (a.review_count || 0);
    });

    return NextResponse.json({
      results: rows,
      total: rows.length,
      query: {
        q,
        location,
        sort,
        tier,
        lat: hasOrigin ? latNum : null,
        lng: hasOrigin ? lngNum : null,
        radius: hasOrigin ? radiusNum : null,
        rating: ratingNum,
      },
    });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Failed to search clinics" },
      { status: 500 }
    );
  }
}
