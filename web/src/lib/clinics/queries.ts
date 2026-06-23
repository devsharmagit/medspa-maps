import pool from "@/lib/db";

export interface ClinicPageData {
  clinic: {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    about: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    phone: string | null;
    website: string | null;
    booking_url: string | null;
    google_maps_url: string | null;
    hours: unknown;
    instagram_url: string | null;
    facebook_url: string | null;
    youtube_url: string | null;
    founded_year: number | null;
    avg_rating: string | null;
    review_count: number;
    ext_rating: string | null;
    ext_review_count: number | null;
    verified: boolean;
    featured: boolean;
    logo_url: string | null;
  };
  treatments: { name: string; slug: string | null }[];
  gallery: { source_url: string; alt_text: string | null }[];
  gallery_total: number;
  before_after: { source_url: string; alt_text: string | null }[];
  before_after_total: number;
  reviews: { rating: number | null; body: string; reviewer_name: string | null }[];
  stats: {
    treatments_count: number;
    review_count: number | null;
    rating: string | null;
    city: string | null;
  };
}

/** Shared loader used by both the clinic page (SSR) and the API route. */
export async function getClinicData(slug: string): Promise<ClinicPageData | null> {
  const clinic = await pool.query(
    `SELECT
       c.id, c.slug, c.name, c.tagline, c.about, c.address, c.city, c.state,
       c.zip, c.phone, c.website, c.booking_url, c.google_maps_url, c.hours, c.instagram_url,
       c.facebook_url, c.youtube_url, c.founded_year, c.avg_rating,
       c.review_count, c.ext_rating, c.ext_review_count, c.verified, c.featured,
       c.business_id,
       -- Logo: scraped logos live at the clinic level; fall back to the
       -- business-level logo for synced records.
       COALESCE(
         (SELECT source_url FROM images i
            WHERE i.entity_type = 'clinic' AND i.entity_id = c.id
              AND i.role = 'logo' AND i.scrape_status = 'ok'
            ORDER BY i.sort_order LIMIT 1),
         (SELECT source_url FROM images i
            WHERE i.entity_type = 'business' AND i.entity_id = c.business_id
              AND i.role = 'logo' AND i.scrape_status = 'ok'
            ORDER BY i.sort_order LIMIT 1)
       ) AS logo_url
     FROM clinics c
     WHERE c.slug = $1 AND c.is_active = true`,
    [slug]
  );
  if (clinic.rows.length === 0) return null;
  const c = clinic.rows[0];

  const [gallery, galleryCount, beforeAfter, beforeAfterCount, treatments, reviews] = await Promise.all([
    pool.query(
      `SELECT source_url, alt_text
       FROM images
       WHERE entity_type = 'clinic' AND entity_id = $1
         AND role IN ('gallery', 'cover') AND scrape_status = 'ok'
       ORDER BY (role = 'cover') DESC, sort_order
       LIMIT 24`,
      [c.id]
    ),
    pool.query(
      `SELECT count(*)::int AS total
       FROM images
       WHERE entity_type = 'clinic' AND entity_id = $1
         AND role IN ('gallery', 'cover') AND scrape_status = 'ok'`,
      [c.id]
    ),
    pool.query(
      `SELECT source_url, alt_text
       FROM images
       WHERE entity_type = 'clinic' AND entity_id = $1
         AND role = 'before_after' AND scrape_status = 'ok'
       ORDER BY sort_order
       LIMIT 24`,
      [c.id]
    ),
    pool.query(
      `SELECT count(*)::int AS total
       FROM images
       WHERE entity_type = 'clinic' AND entity_id = $1
         AND role = 'before_after' AND scrape_status = 'ok'`,
      [c.id]
    ),
    pool.query(
      // Only treatments mapped to a canonical service — unmatched scraped rows
      // (nav junk like "Press Release", "View More Testimonials") are excluded.
      `SELECT DISTINCT s.name AS name, s.slug AS slug
       FROM clinic_services cls
       JOIN services s ON s.id = cls.service_id AND s.is_active = true
       WHERE cls.clinic_id = $1 AND cls.is_active = true
       ORDER BY name`,
      [c.id]
    ),
    pool.query(
      `SELECT rating, body, reviewer_name
       FROM reviews
       WHERE clinic_id = $1 AND is_approved = true AND is_active = true
       ORDER BY rating DESC NULLS LAST
       LIMIT 12`,
      [c.id]
    ),
  ]);

  const treatments_count = treatments.rows.length;

  return {
    clinic: {
      id: c.id,
      slug: c.slug,
      name: c.name,
      tagline: c.tagline,
      about: c.about,
      address: c.address,
      city: c.city,
      state: c.state,
      zip: c.zip,
      phone: c.phone,
      website: c.website,
      booking_url: c.booking_url,
      google_maps_url: c.google_maps_url,
      hours: c.hours,
      instagram_url: c.instagram_url,
      facebook_url: c.facebook_url,
      youtube_url: c.youtube_url,
      founded_year: c.founded_year,
      avg_rating: c.avg_rating,
      review_count: c.review_count,
      ext_rating: c.ext_rating,
      ext_review_count: c.ext_review_count,
      verified: c.verified,
      featured: c.featured,
      logo_url: c.logo_url,
    },
    treatments: treatments.rows,
    gallery: gallery.rows,
    gallery_total: galleryCount.rows[0]?.total ?? 0,
    before_after: beforeAfter.rows,
    before_after_total: beforeAfterCount.rows[0]?.total ?? 0,
    reviews: reviews.rows,
    stats: {
      treatments_count,
      review_count: c.ext_review_count ?? c.review_count,
      rating: c.ext_rating ?? c.avg_rating,
      city: c.city,
    },
  } as ClinicPageData;
}
