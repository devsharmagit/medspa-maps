import pool from "@/lib/db";

export interface ClinicLocation {
  id: string;
  label: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  booking_url: string | null;
  google_maps_url: string | null;
  hours: unknown;
  is_primary: boolean;
  lat: number | null;
  lng: number | null;
}

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
    tiktok_url: string | null;
    youtube_url: string | null;
    x_url: string | null;
    linkedin_url: string | null;
    yelp_url: string | null;
    founded_year: number | null;
    avg_rating: string | null;
    review_count: number;
    ext_rating: string | null;
    ext_review_count: number | null;
    verified: boolean;
    featured: boolean;
    logo_url: string | null;
    // Admin-editable hero stat overrides (display strings, e.g. "20+", "10k+").
    // NULL → the clinic page falls back to its computed/default value.
    stat_experts: string | null;
    stat_cities: string | null;
    stat_treatments: string | null;
    stat_rating: string | null;
    stat_patients: string | null;
  };
  locations: ClinicLocation[];
  treatments: { name: string; slug: string | null; price_from: number | null; price_unit: string | null }[];
  /** Evidence-based concerns this clinic treats (scraped ∪ manual − removed),
   *  each with the treatments its own website pairs with the concern. */
  concerns: { name: string; slug: string }[];
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
  providers: {
    id: string;
    name: string;
    title: string | null;
    image_url: string | null;
    is_verified: boolean;
  }[];
}

/** Shared loader used by both the clinic page (SSR) and the API route. */
export async function getClinicData(slug: string): Promise<ClinicPageData | null> {
  const clinic = await pool.query(
    `SELECT
       c.id, c.slug, c.name, c.tagline, c.about, c.address, c.city, c.state,
       c.zip, c.phone, c.website, c.booking_url, c.google_maps_url, c.hours, c.instagram_url,
       c.facebook_url, c.tiktok_url, c.youtube_url, c.x_url, c.linkedin_url, c.yelp_url,
       c.founded_year, c.avg_rating,
       c.review_count, c.ext_rating, c.ext_review_count, c.verified, c.featured,
       c.stat_experts, c.stat_cities, c.stat_treatments, c.stat_rating, c.stat_patients,
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

  const [gallery, galleryCount, beforeAfter, beforeAfterCount, treatments, concerns, reviews, locationsResult, providersResult] = await Promise.all([
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
      // Use DISTINCT ON to pick the lowest price_from per service.
      `SELECT t.name, t.slug, t.price_from, t.price_unit
       FROM (
         SELECT DISTINCT ON (s.id)
           s.name, s.slug, cls.price_from, cls.price_unit
         FROM clinic_services cls
         JOIN services s ON s.id = cls.service_id
          AND s.is_active = true
          AND COALESCE(s.is_published, true) = true
          AND COALESCE(s.review_status, 'approved') = 'approved'
          AND s.name !~* '(dentistry|dental|orthodont|veneer)'
         WHERE cls.clinic_id = $1 AND cls.is_active = true
         ORDER BY s.id, cls.price_from ASC NULLS LAST
       ) t
       ORDER BY t.name`,
      [c.id]
    ),
    pool.query(
      // Evidence-based concerns: website-scraped (source='scraped') plus admin
      // manual additions, minus admin 'removed' suppressions. Never derived
      // from services. Display is the condition name only — the treatment
      // pairing stays in clinic_concern_evidence but is not surfaced here.
      `SELECT co.name, co.slug
       FROM clinic_concerns cc
       JOIN concerns co ON co.id = cc.concern_id AND co.is_active = true
       WHERE cc.clinic_id = $1 AND cc.is_active = true
         AND cc.source IN ('scraped','manual')
         AND (
           cc.source = 'manual'
           OR EXISTS (
             SELECT 1 FROM clinic_concern_evidence ev
             WHERE ev.clinic_id = cc.clinic_id AND ev.concern_id = cc.concern_id
           )
         )
         AND NOT EXISTS (
           SELECT 1 FROM clinic_concerns cr
           WHERE cr.clinic_id = cc.clinic_id AND cr.concern_id = cc.concern_id
             AND cr.source = 'removed' AND cr.is_active = true
         )
       ORDER BY co.name`,
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
    pool.query(
      `SELECT id, label, address, city, state, zip, phone,
              booking_url, google_maps_url, hours, is_primary, lat, lng
         FROM clinic_locations
        WHERE clinic_id = $1 AND is_active = true
        ORDER BY sort_order, created_at`,
      [c.id]
    ),
    pool.query(
      // Only providers WITH a headshot — never surface a card that would fall
      // back to the stock placeholder. (Some clinics' team photos are JS-rendered
      // and can't be scraped statically, so those providers have no image_url.)
      `SELECT id, name, title, image_url, is_verified
       FROM providers
       WHERE clinic_id = $1 AND is_active = true
         AND image_url IS NOT NULL AND image_url <> ''
       ORDER BY (card_tagline IS NOT NULL) DESC, name`,
      [c.id]
    ),
  ]);

  const treatments_count = treatments.rows.length;

  return {
    // pg returns numeric columns as strings when no type parser is registered.
    locations: locationsResult.rows.map((r) => ({
      ...r,
      lat: r.lat != null ? Number(r.lat) : null,
      lng: r.lng != null ? Number(r.lng) : null,
    })) as ClinicLocation[],
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
      tiktok_url: c.tiktok_url,
      youtube_url: c.youtube_url,
      x_url: c.x_url,
      linkedin_url: c.linkedin_url,
      yelp_url: c.yelp_url,
      founded_year: c.founded_year,
      avg_rating: c.avg_rating,
      review_count: c.review_count,
      ext_rating: c.ext_rating,
      ext_review_count: c.ext_review_count,
      verified: c.verified,
      featured: c.featured,
      logo_url: c.logo_url,
      stat_experts: c.stat_experts,
      stat_cities: c.stat_cities,
      stat_treatments: c.stat_treatments,
      stat_rating: c.stat_rating,
      stat_patients: c.stat_patients,
    },
    treatments: treatments.rows,
    concerns: concerns.rows,
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
    providers: providersResult.rows,
  } as ClinicPageData;
}
