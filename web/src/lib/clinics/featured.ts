import pool from "@/lib/db";

export interface FeaturedClinic {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  verified: boolean;
  featured: boolean;
  /** Display rating: internal average, else external/Google. Null if none. */
  rating: number | null;
  reviewCount: number;
  services: { name: string; slug: string }[];
  logo: string | null;
  coverImage: string | null;
  gallery: string[];
  bookingUrl: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
}

interface FeaturedRow {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  verified: boolean;
  featured: boolean;
  avg_rating: string | null;
  review_count: number | null;
  ext_rating: string | null;
  ext_review_count: number | null;
  booking_url: string | null;
  website: string | null;
  lat: string | null;
  lng: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  gallery_images: string[] | null;
  services: { name: string; slug: string }[] | null;
}

/**
 * Featured clinics for the landing-page showcase. Featured are pinned first;
 * we backfill with the top-rated active clinics so the carousel is always full
 * even if fewer than `limit` clinics are flagged featured.
 */
export async function getFeaturedClinics(limit = 5): Promise<FeaturedClinic[]> {
  const { rows } = await pool.query<FeaturedRow>(
    `SELECT
       c.id, c.name, c.slug, c.city, c.state, c.verified, c.featured,
       c.avg_rating, c.review_count, c.ext_rating, c.ext_review_count,
       c.booking_url, c.website, c.lat, c.lng,
       COALESCE(
         (SELECT source_url FROM images i
            WHERE i.entity_type = 'clinic' AND i.entity_id = c.id
              AND i.role = 'logo' AND i.scrape_status = 'ok'
            ORDER BY i.sort_order LIMIT 1),
         (SELECT source_url FROM images i
            WHERE i.entity_type = 'business' AND i.entity_id = b.id
              AND i.role = 'logo' AND i.scrape_status = 'ok'
            ORDER BY i.sort_order LIMIT 1)
       ) AS logo_url,
       (
         SELECT COALESCE(cdn_url, source_url) FROM images
         WHERE entity_type = 'clinic' AND entity_id = c.id
           AND role IN ('cover', 'gallery') AND scrape_status = 'ok'
         ORDER BY (role = 'cover') DESC, sort_order LIMIT 1
       ) AS cover_image_url,
       (
         SELECT COALESCE(json_agg(url ORDER BY ord, so), '[]'::json) FROM (
           SELECT COALESCE(cdn_url, source_url) AS url,
             CASE role WHEN 'cover' THEN 0 WHEN 'gallery' THEN 1 ELSE 2 END AS ord,
             sort_order AS so
           FROM images
           WHERE entity_type = 'clinic' AND entity_id = c.id
             AND role IN ('cover', 'gallery', 'before_after')
             AND scrape_status = 'ok'
           ORDER BY ord, so
           LIMIT 8
         ) g
       ) AS gallery_images,
       (
         SELECT COALESCE(json_agg(t), '[]'::json) FROM (
           SELECT DISTINCT sv.name AS name, sv.slug AS slug
           FROM clinic_services cs
           JOIN services sv ON sv.id = cs.service_id AND sv.is_active = TRUE
           WHERE cs.clinic_id = c.id AND cs.is_active = TRUE
           LIMIT 6
         ) t
       ) AS services
     FROM clinics c
     JOIN businesses b ON b.id = c.business_id
     WHERE c.is_active = TRUE AND b.is_active = TRUE
     ORDER BY
       c.featured DESC,
       COALESCE(c.avg_rating, c.ext_rating) DESC NULLS LAST,
       c.review_count DESC NULLS LAST
     LIMIT $1`,
    [limit]
  );

  return rows.map((r) => {
    const rating = r.avg_rating ?? r.ext_rating;
    const reviewCount = r.avg_rating != null ? r.review_count : r.ext_review_count;
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      city: r.city,
      state: r.state,
      verified: r.verified,
      featured: r.featured,
      rating: rating != null ? Number(rating) : null,
      reviewCount: reviewCount ?? 0,
      services: r.services ?? [],
      logo: r.logo_url,
      coverImage: r.cover_image_url,
      gallery: r.gallery_images ?? [],
      bookingUrl: r.booking_url,
      website: r.website,
      lat: r.lat != null ? Number(r.lat) : null,
      lng: r.lng != null ? Number(r.lng) : null,
    };
  });
}
