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
  const sort = searchParams.get("sort") || "rating"; // rating | name | reviews
  const tier = searchParams.get("tier") || "";

  try {
    const conditions: string[] = ["c.is_active = TRUE", "b.is_active = TRUE"];
    const params: (string | number)[] = [];
    let paramIdx = 1;

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

    // Location search — dropdown passes 2-letter abbreviations; DB stores full names
    if (location) {
      const upper = location.toUpperCase();
      const fullName = STATE_ABBR_TO_NAME[upper];
      if (fullName) {
        // Exact full-name match (case-insensitive) — most precise
        conditions.push(`c.state ILIKE $${paramIdx}`);
        params.push(fullName);
      } else {
        // Free-text fallback: city, state name, zip
        conditions.push(`(
          c.city ILIKE $${paramIdx}
          OR c.state ILIKE $${paramIdx}
          OR c.zip ILIKE $${paramIdx}
        )`);
        params.push(`%${location}%`);
      }
      paramIdx++;
    }

    // Tier filter
    if (tier && ["free", "featured", "elite"].includes(tier)) {
      conditions.push(`c.tier = $${paramIdx}`);
      params.push(tier);
      paramIdx++;
    }

    // Sort order
    let orderBy = "c.featured DESC, c.avg_rating DESC NULLS LAST, c.review_count DESC";
    if (sort === "name") orderBy = "c.name ASC";
    else if (sort === "reviews") orderBy = "c.review_count DESC, c.avg_rating DESC NULLS LAST";

    const query = `
      SELECT DISTINCT ON (c.id)
        c.id AS clinic_id,
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
          SELECT COALESCE(json_agg(json_build_object(
            'name', COALESCE(sv.name, cs2.raw_name),
            'slug', COALESCE(sv.slug, slugify(cs2.raw_name))
          )), '[]'::json)
          FROM clinic_services cs2
          LEFT JOIN services sv ON sv.id = cs2.service_id
          WHERE cs2.clinic_id = c.id AND cs2.is_active = TRUE
          LIMIT 8
        ) AS services,
        (
          SELECT source_url FROM images
          WHERE entity_type = 'clinic' AND entity_id = c.id
          AND role = 'cover' AND scrape_status = 'ok'
          ORDER BY sort_order LIMIT 1
        ) AS cover_image_url,
        '[]'::json AS providers
      FROM clinics c
      JOIN businesses b ON b.id = c.business_id
      LEFT JOIN clinic_services cs ON cs.clinic_id = c.id AND cs.is_active = TRUE
      LEFT JOIN services s ON s.id = cs.service_id AND s.is_active = TRUE
      WHERE ${conditions.join(" AND ")}
      ORDER BY c.id, ${orderBy}
      LIMIT 50
    `;

    const result = await pool.query(query, params);

    // Re-sort since DISTINCT ON forces ordering by c.id first
    const rows = result.rows;
    if (sort === "name") {
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
      query: { q, location, sort, tier },
    });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Failed to search clinics" },
      { status: 500 }
    );
  }
}
