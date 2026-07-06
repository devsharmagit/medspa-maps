import pool from "@/lib/db";
import { getProvidersByConcernId, type ConcernProvider } from "@/lib/providers/queries";

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
    featured: boolean;
    lat: string | null;
    lng: string | null;
    images: { source_url: string; role: string; sort_order: number }[];
  }[];

  providers: ConcernProvider[];
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

  const [services, beforeAfter, clinics] = await Promise.all([
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
      // EFFECTIVE membership: a clinic appears for a concern when it is DERIVED
      // (offers a service curated for this concern via concern_services) OR has
      // an active manual override (clinic_concerns source='manual'), and is NOT
      // suppressed by an active removed override (source='removed').
      `SELECT DISTINCT ON (cl.id)
         cl.id, cl.name, cl.slug, cl.city, cl.state, cl.website,
         cl.booking_url, cl.avg_rating, cl.review_count, cl.verified, cl.featured,
         cl.lat, cl.lng,
         (SELECT COALESCE(json_agg(
            json_build_object('source_url', i.source_url, 'role', i.role, 'sort_order', i.sort_order)
            ORDER BY (i.role='cover') DESC, i.sort_order
          ), '[]'::json)
          FROM images i
          WHERE i.entity_type = 'clinic' AND i.entity_id = cl.id
         ) AS images,
         (SELECT COALESCE(i2.cdn_url, i2.source_url) FROM images i2
          WHERE i2.entity_type = 'clinic' AND i2.entity_id = cl.id
            AND i2.role IN ('cover','gallery') AND i2.scrape_status = 'ok'
          ORDER BY (i2.role = 'cover') DESC, i2.sort_order LIMIT 1
         ) AS cover_image
       FROM clinics cl
       WHERE cl.is_active = true
         AND (
           EXISTS (
             SELECT 1 FROM concern_services cs
             JOIN clinic_services cls ON cls.service_id = cs.service_id AND cls.is_active = true
             WHERE cs.concern_id = $1 AND cls.clinic_id = cl.id
           )
           OR EXISTS (
             SELECT 1 FROM clinic_concerns cc
             WHERE cc.clinic_id = cl.id AND cc.concern_id = $1
               AND cc.source = 'manual' AND cc.is_active = true
           )
         )
         AND NOT EXISTS (
           SELECT 1 FROM clinic_concerns cc
           WHERE cc.clinic_id = cl.id AND cc.concern_id = $1
             AND cc.source = 'removed' AND cc.is_active = true
         )
       ORDER BY cl.id`,
      [c.id]
    ),
  ]);

  const clinicRows = clinics.rows.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    if (a.verified !== b.verified) return a.verified ? -1 : 1;
    return (Number(b.avg_rating) || 0) - (Number(a.avg_rating) || 0);
  });

  const providers = await getProvidersByConcernId(c.id);

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
    providers,
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
