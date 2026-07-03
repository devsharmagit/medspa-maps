import pool from "@/lib/db";

export interface TreatmentPageData {
  service: {
    id: string;
    name: string;
    slug: string;
    summary: string | null;
    description: string | null;
    price_from: string | null;
    price_unit: string | null;
    treatment_time: string | null;
    results_timeline: string | null;
    results_duration: string | null;
    hero_rating: string | null;
    hero_review_count: number | null;
    faqs: { q: string; a: string }[];
  };
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
    price_from: string | null;
    price_unit: string | null;
    distance_km: number | null;
  }[];

  providers: {
    id: string;
    clinic_id: string;
    name: string;
    title: string | null;
    bio: string | null;
    card_tagline: string | null;
    review_rating: string | null;
    image_url: string | null;
    years_experience: number | null;
    highlights: any;
    specialties: any;
    clinic_name: string;
    avg_rating: string | null;
    review_count: number;
    lat: string | null;
    lng: string | null;
    distance_km: number | null;
  }[];
}

/** Haversine distance in km between two lat/lng points. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Shared loader used by both the treatment page (SSR) and the API route. */
export async function getTreatmentData(
  slug: string,
  opts?: { lat?: number; lng?: number }
): Promise<TreatmentPageData | null> {
  const service = await pool.query(
    `SELECT id, name, slug, summary, description, price_from, price_unit,
            treatment_time, results_timeline, results_duration,
            hero_rating, hero_review_count, aliases, faqs
     FROM services
     WHERE slug = $1 AND is_active = true`,
    [slug]
  );
  if (service.rows.length === 0) return null;
  const s = service.rows[0];

  // Build "%alias%" patterns for the raw_name fuzzy match.
  const aliasPatterns: string[] = (s.aliases ?? []).map(
    (a: string) => `%${a}%`
  );

  const [clinics, providers] = await Promise.all([
    pool.query(
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
         ) AS cover_image,
         COALESCE(cls.price_from, $2) AS price_from,
         COALESCE(cls.price_unit, $3) AS price_unit
       FROM clinic_services cls
       JOIN clinics cl ON cl.id = cls.clinic_id AND cl.is_active = true
       WHERE cls.is_active = true
         AND (
           cls.service_id = $1
           OR cls.raw_name ILIKE '%' || $4 || '%'
           OR cls.raw_name ILIKE ANY($5)
         )
       ORDER BY cl.id`,
      [s.id, s.price_from, s.price_unit, s.name, aliasPatterns]
    ),
    pool.query(
      `SELECT DISTINCT ON (p.id)
         p.id, p.clinic_id, p.name, p.title, p.bio, p.card_tagline, p.review_rating,
         p.review_count, p.image_url, p.years_experience,
         p.highlights, p.specialties,
         cl.name AS clinic_name, cl.avg_rating, cl.lat, cl.lng
       FROM provider_services ps
       JOIN providers p ON p.id = ps.provider_id AND p.is_active = true
       JOIN clinics cl ON cl.id = p.clinic_id AND cl.is_active = true
       JOIN clinic_services cls ON cls.clinic_id = cl.id AND cls.is_active = true
       WHERE (
         ps.service_id = $1
         OR cls.service_id = $1
         OR cls.raw_name ILIKE '%' || $2 || '%'
         OR cls.raw_name ILIKE ANY($3)
       )
       ORDER BY p.id`,
      [s.id, s.name, aliasPatterns]
    ),
  ]);

  const hasLocation =
    opts?.lat !== undefined &&
    opts?.lng !== undefined &&
    Number.isFinite(opts.lat) &&
    Number.isFinite(opts.lng);

  let clinicRows = clinics.rows.map((c) => {
    let distance_km: number | null = null;
    if (hasLocation && c.lat !== null && c.lng !== null) {
      distance_km = haversineKm(
        opts!.lat!,
        opts!.lng!,
        Number(c.lat),
        Number(c.lng)
      );
    }
    return { ...c, distance_km };
  });

  if (hasLocation) {
    clinicRows = clinicRows.sort((a, b) => {
      const ad = a.distance_km;
      const bd = b.distance_km;
      if (ad !== bd) {
        if (ad === null) return 1;
        if (bd === null) return -1;
        return ad - bd;
      }
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      return (Number(b.avg_rating) || 0) - (Number(a.avg_rating) || 0);
    });
  } else {
    clinicRows = clinicRows.sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      const ar = Number(a.avg_rating) || 0;
      const br = Number(b.avg_rating) || 0;
      if (ar !== br) return br - ar;
      return (b.review_count || 0) - (a.review_count || 0);
    });
  }

  let providerRows = providers.rows.map((p) => {
    let distance_km: number | null = null;
    if (hasLocation && p.lat !== null && p.lng !== null) {
      distance_km = haversineKm(
        opts!.lat!,
        opts!.lng!,
        Number(p.lat),
        Number(p.lng)
      );
    }
    return { ...p, distance_km };
  });

  if (hasLocation) {
    providerRows = providerRows.sort((a, b) => {
      if (a.distance_km !== null && b.distance_km !== null) {
        return a.distance_km - b.distance_km;
      }
      return 0;
    });
  } else {
    providerRows = providerRows.sort((a, b) => {
      const ar = Number(a.avg_rating) || 0;
      const br = Number(b.avg_rating) || 0;
      if (ar !== br) return br - ar;
      return (b.review_count || 0) - (a.review_count || 0);
    });
  }

  return {
    service: {
      id: s.id,
      name: s.name,
      slug: s.slug,
      summary: s.summary,
      description: s.description,
      price_from: s.price_from,
      price_unit: s.price_unit,
      treatment_time: s.treatment_time,
      results_timeline: s.results_timeline,
      results_duration: s.results_duration,
      hero_rating: s.hero_rating,
      hero_review_count: s.hero_review_count,
      faqs: s.faqs ?? [],
    },
    clinics: clinicRows,
    providers: providerRows,
  } as TreatmentPageData;
}

export interface TreatmentListItem {
  slug: string;
  name: string;
  summary: string | null;
  has_content: boolean;
  price_from: string | null;
  price_unit: string | null;
  hero_rating: string | null;
  hero_review_count: number | null;
  clinic_count: number;
}

/**
 * List of treatments for the /treatments index. Includes a clinic count and
 * rating, and drops pure-noise rows (no editorial content AND offered by no
 * clinic — e.g. stray scraped anchor text). Content-rich treatments first.
 */
export async function listTreatments(): Promise<TreatmentListItem[]> {
  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT
         s.slug, s.name, s.summary,
         (s.description IS NOT NULL) AS has_content,
         s.price_from, s.price_unit, s.hero_rating, s.hero_review_count,
         (
           SELECT count(DISTINCT cl.id)::int
           FROM clinic_services cs
           JOIN clinics cl ON cl.id = cs.clinic_id AND cl.is_active = true
           WHERE cs.is_active = true
             AND (cs.service_id = s.id
                  OR cs.raw_name ILIKE '%' || regexp_replace(s.name, '[®™]', '', 'g') || '%')
         ) AS clinic_count
       FROM services s
       WHERE s.is_active = true
     ) t
     WHERE t.has_content = true OR t.clinic_count > 0
     ORDER BY t.has_content DESC, t.clinic_count DESC, t.name`
  );
  return rows as TreatmentListItem[];
}
