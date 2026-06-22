import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  try {
    const result = await pool.query(
      `
      SELECT
        c.id AS clinic_id,
        c.slug AS clinic_slug,
        c.name AS clinic_name,
        c.address,
        c.city,
        c.state,
        c.zip,
        c.country,
        c.lat,
        c.lng,
        c.phone,
        c.email,
        c.website,
        c.booking_url,
        c.about,
        c.hours,
        c.avg_rating,
        c.review_count,
        c.featured,
        c.tier,
        c.verified,
        c.google_place_id,
        c.instagram_url,
        c.facebook_url,
        c.tiktok_url,
        c.youtube_url,
        c.x_url,
        c.linkedin_url,
        c.yelp_url,
        c.google_my_business,
        b.id AS business_id,
        b.name AS business_name,
        (
          SELECT source_url FROM images
          WHERE entity_type = 'business' AND entity_id = b.id
            AND role = 'logo' AND scrape_status = 'ok'
          ORDER BY sort_order LIMIT 1
        ) AS logo_url,
        (
          SELECT source_url FROM images
          WHERE entity_type = 'clinic' AND entity_id = c.id
            AND role = 'cover' AND scrape_status = 'ok'
          ORDER BY sort_order LIMIT 1
        ) AS cover_image_url,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'id', img.id,
            'url', img.source_url,
            'cdn_url', img.cdn_url,
            'alt_text', img.alt_text,
            'role', img.role
          ) ORDER BY img.sort_order), '[]'::json)
          FROM images img
          WHERE img.entity_type = 'clinic' AND img.entity_id = c.id
            AND img.scrape_status = 'ok' AND img.role = 'gallery'
          LIMIT 12
        ) AS gallery_images,
        (
          SELECT COALESCE(json_agg(json_build_object(
            'name', COALESCE(sv.name, cs.raw_name),
            'slug', COALESCE(sv.slug, cs.raw_name),
            'category', sv.category,
            'description', cs.description
          ) ORDER BY sv.name NULLS LAST), '[]'::json)
          FROM clinic_services cs
          LEFT JOIN services sv ON sv.id = cs.service_id
          WHERE cs.clinic_id = c.id AND cs.is_active = TRUE
        ) AS services
      FROM clinics c
      JOIN businesses b ON b.id = c.business_id
      WHERE c.slug = $1 AND c.is_active = TRUE AND b.is_active = TRUE
      LIMIT 1
      `,
      [slug]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
    }

    return NextResponse.json({ clinic: result.rows[0] });
  } catch (err) {
    console.error("Clinic API error:", err);
    return NextResponse.json({ error: "Failed to fetch clinic" }, { status: 500 });
  }
}
