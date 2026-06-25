import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

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
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

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

  const latNum = latRaw !== null ? Number(latRaw) : NaN;
  const lngNum = lngRaw !== null ? Number(lngRaw) : NaN;
  const hasOrigin = Number.isFinite(latNum) && Number.isFinite(lngNum);

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
    // Only clinics with non-null lat/lng can match when an origin is given.
    let distanceExpr = "NULL::float";
    if (hasOrigin) {
      const latParam = paramIdx;
      const lngParam = paramIdx + 1;
      // 3959 = Earth radius in miles
      distanceExpr = `(
        3959 * acos(
          GREATEST(-1, LEAST(1,
            cos(radians($${latParam})) * cos(radians(c.lat))
            * cos(radians(c.lng) - radians($${lngParam}))
            + sin(radians($${latParam})) * sin(radians(c.lat))
          ))
        )
      )`;
      params.push(latNum, lngNum);
      paramIdx += 2;
      conditions.push("c.lat IS NOT NULL AND c.lng IS NOT NULL");
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

    // Location search — checks both clinics table AND clinic_locations for multi-location clinics
    if (location) {
      const upper = location.toUpperCase();
      const fullName = STATE_ABBR_TO_NAME[upper];
      if (fullName) {
        conditions.push(`(
          c.state = $${paramIdx} OR c.state ILIKE $${paramIdx + 1}
          OR EXISTS (
            SELECT 1 FROM clinic_locations cl
            WHERE cl.clinic_id = c.id AND cl.is_active = true
              AND (cl.state = $${paramIdx} OR cl.state ILIKE $${paramIdx + 1})
          )
        )`);
        params.push(upper, fullName);
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

    // Rating filter — minimum avg_rating (NULLS excluded)
    if (ratingNum !== null) {
      conditions.push(`c.avg_rating >= $${paramIdx}`);
      params.push(ratingNum);
      paramIdx++;
    }

    // Radius hard-filter — only when an origin is given
    if (hasOrigin) {
      conditions.push(`${distanceExpr} <= $${paramIdx}`);
      params.push(radiusNum);
      paramIdx++;
    }

    // Sort order. DISTINCT ON (c.id) requires c.id to lead the ORDER BY, so the
    // per-clinic tie-break ordering follows it here and JS re-sorts afterwards.
    let orderBy = "c.featured DESC, c.avg_rating DESC NULLS LAST, c.review_count DESC";
    if (sort === "name") orderBy = "c.name ASC";
    else if (sort === "reviews") orderBy = "c.review_count DESC, c.avg_rating DESC NULLS LAST";
    else if (sort === "distance" && hasOrigin) orderBy = "distance_miles ASC, c.featured DESC, c.avg_rating DESC NULLS LAST";

    const query = `
      SELECT DISTINCT ON (c.id)
        c.id AS clinic_id,
        ${distanceExpr} AS distance_miles,
        c.name AS clinic_name,
        c.slug AS clinic_slug,
        c.address,
        c.city,
        c.state,
        c.zip,
        c.phone,
        c.website,
        c.lat,
        c.lng,
        c.avg_rating,
        c.review_count,
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
          SELECT source_url FROM images
          WHERE entity_type = 'clinic' AND entity_id = c.id
          AND role IN ('cover', 'gallery') AND scrape_status = 'ok'
          ORDER BY (role = 'cover') DESC, sort_order LIMIT 1
        ) AS cover_image_url,
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

    if (sort === "distance" && hasOrigin) {
      // Nearest first, then featured, then rating
      rows.sort((a, b) => {
        const da = a.distance_miles ?? Infinity;
        const db = b.distance_miles ?? Infinity;
        if (da !== db) return da - db;
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return (b.avg_rating || 0) - (a.avg_rating || 0);
      });
    } else if (sort === "name") {
      rows.sort((a, b) => a.clinic_name.localeCompare(b.clinic_name));
    } else if (sort === "reviews") {
      rows.sort((a, b) => (b.review_count || 0) - (a.review_count || 0));
    } else {
      // Default: featured first, then by rating
      rows.sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return (b.avg_rating || 0) - (a.avg_rating || 0);
      });
    }

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
