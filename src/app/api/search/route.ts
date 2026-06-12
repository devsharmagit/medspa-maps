import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

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

    // Service / treatment search (searches clinic services, service names, aliases)
    if (q) {
      conditions.push(`(
        s.name ILIKE $${paramIdx}
        OR s.slug = $${paramIdx + 1}
        OR EXISTS (SELECT 1 FROM unnest(s.alias) a WHERE a ILIKE $${paramIdx})
        OR c.name ILIKE $${paramIdx}
        OR b.name ILIKE $${paramIdx}
        OR cat.name ILIKE $${paramIdx}
        OR cat.slug = $${paramIdx + 1}
      )`);
      params.push(`%${q}%`, q);
      paramIdx += 2;
    }

    // Location search (city, state, zip)
    // Handles both exact state abbreviation matches (e.g. "TX") and
    // freetext city/zip/state-name searches
    if (location) {
      // Check if location looks like a 2-letter state abbreviation
      const isAbbreviation = /^[A-Z]{2}$/.test(location.toUpperCase());
      if (isAbbreviation) {
        conditions.push(`c.state ILIKE $${paramIdx}`);
        params.push(location);
      } else {
        conditions.push(`(
          c.city ILIKE $${paramIdx}
          OR c.state ILIKE $${paramIdx}
          OR c.zip ILIKE $${paramIdx}
          OR (c.city || ', ' || c.state) ILIKE $${paramIdx}
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
        b.id AS business_id,
        b.name AS business_name,
        b.slug AS business_slug,
        b.logo_url,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'name', sv.name,
            'slug', sv.slug,
            'price_from', cs2.price_from,
            'price_to', cs2.price_to
          )), '[]'::json)
          FROM clinic_services cs2
          JOIN services sv ON sv.id = cs2.service_id
          WHERE cs2.clinic_id = c.id AND cs2.is_active = TRUE
          LIMIT 8
        ) AS services,
        (
          SELECT source_url FROM images
          WHERE entity_type = 'clinic' AND entity_id = c.id
          AND role = 'cover' AND scrape_status = 'ok'
          ORDER BY sort_order LIMIT 1
        ) AS cover_image_url,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'name', p.name,
            'title', p.title,
            'slug', p.slug
          )), '[]'::json)
          FROM clinic_providers cp
          JOIN providers p ON p.id = cp.provider_id
          WHERE cp.clinic_id = c.id AND cp.is_active = TRUE
          LIMIT 3
        ) AS providers
      FROM clinics c
      JOIN businesses b ON b.id = c.business_id
      LEFT JOIN clinic_services cs ON cs.clinic_id = c.id AND cs.is_active = TRUE
      LEFT JOIN services s ON s.id = cs.service_id AND s.is_active = TRUE
      LEFT JOIN service_categories sc ON sc.service_id = s.id
      LEFT JOIN categories cat ON cat.id = sc.category_id
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
