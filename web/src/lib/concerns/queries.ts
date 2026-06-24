import pool from "@/lib/db";

export interface ConcernPageData {
  concern: {
    id: string;
    name: string;
    slug: string;
    overview: string | null;
    details: Record<string, string>;
    faqs: { q: string; a: string }[];
    meta_title: string | null;
    meta_description: string | null;
    source_url: string | null;
  };
  services: { id: string; name: string; slug: string; category: string | null }[];
  beforeAfter: { source_url: string; cdn_url: string | null; alt_text: string | null }[];
  clinics: {
    id: string;
    name: string;
    slug: string;
    city: string | null;
    state: string | null;
    website: string | null;
    booking_url: string | null;
    avg_rating: string | null;
    review_count: number;
    verified: boolean;
    cover_image: string | null;
  }[];
  reviews: {
    rating: number | null;
    body: string;
    reviewer_name: string | null;
    source: string;
    clinic_name: string;
  }[];
}

/** Shared loader used by both the concern page (SSR) and the API route. */
export async function getConcernData(slug: string): Promise<ConcernPageData | null> {
  const concern = await pool.query(
    `SELECT id, name, slug, overview, details, faqs, meta_title, meta_description, source_url
     FROM concerns
     WHERE slug = $1 AND is_active = true AND is_published = true`,
    [slug]
  );
  if (concern.rows.length === 0) return null;
  const c = concern.rows[0];

  const [services, beforeAfter, clinics, reviews] = await Promise.all([
    pool.query(
      `SELECT s.id, s.name, s.slug, s.category
       FROM concern_services cs
       JOIN services s ON s.id = cs.service_id AND s.is_active = true
       WHERE cs.concern_id = $1
       ORDER BY cs.display_order, s.name`,
      [c.id]
    ),
    pool.query(
      `SELECT source_url, cdn_url, alt_text
       FROM images
       WHERE entity_type = 'concern' AND entity_id = $1
         AND role = 'before_after' AND scrape_status = 'ok'
       ORDER BY sort_order LIMIT 12`,
      [c.id]
    ),
    pool.query(
      `SELECT DISTINCT ON (cl.id)
         cl.id, cl.name, cl.slug, cl.city, cl.state, cl.website,
         cl.booking_url, cl.avg_rating, cl.review_count, cl.verified,
         (SELECT source_url FROM images i
            WHERE i.entity_type = 'clinic' AND i.entity_id = cl.id
            ORDER BY (i.role='cover') DESC, i.sort_order LIMIT 1) AS cover_image
       FROM concern_services cs
       JOIN clinic_services cls ON cls.service_id = cs.service_id AND cls.is_active = true
       JOIN clinics cl ON cl.id = cls.clinic_id AND cl.is_active = true
       WHERE cs.concern_id = $1
       ORDER BY cl.id`,
      [c.id]
    ),
    pool.query(
      `SELECT DISTINCT ON (r.id) r.rating, r.body, r.reviewer_name, r.source, cl.name AS clinic_name
       FROM concern_services cs
       JOIN clinic_services cls ON cls.service_id = cs.service_id AND cls.is_active = true
       JOIN clinics cl ON cl.id = cls.clinic_id AND cl.is_active = true
       JOIN reviews r ON r.clinic_id = cl.id AND r.is_approved = true AND r.is_active = true
       WHERE cs.concern_id = $1
       ORDER BY r.id, r.rating DESC NULLS LAST LIMIT 12`,
      [c.id]
    ),
  ]);

  const clinicRows = clinics.rows.sort((a, b) => {
    if (a.verified !== b.verified) return a.verified ? -1 : 1;
    return (Number(b.avg_rating) || 0) - (Number(a.avg_rating) || 0);
  });

  return {
    concern: {
      id: c.id,
      name: c.name,
      slug: c.slug,
      overview: c.overview,
      details: c.details ?? {},
      faqs: c.faqs ?? [],
      meta_title: c.meta_title,
      meta_description: c.meta_description,
      source_url: c.source_url,
    },
    services: services.rows,
    beforeAfter: beforeAfter.rows,
    clinics: clinicRows,
    reviews: reviews.rows,
  } as ConcernPageData;
}

/** List of published concerns. */
export async function listConcerns() {
  const { rows } = await pool.query(
    `SELECT c.slug, c.name, c.overview,
       (SELECT count(*)::int FROM concern_services cs WHERE cs.concern_id = c.id) AS service_count
     FROM concerns c
     WHERE c.is_active = true AND c.is_published = true
     ORDER BY c.name`
  );
  return rows;
}
