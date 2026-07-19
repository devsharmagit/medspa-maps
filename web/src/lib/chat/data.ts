/**
 * data.ts — server-side data retrieval for the AI assistant.
 *
 * These are plain functions the backend calls directly (NOT model-invoked
 * tools). Each is grounded in real Medspa Map data: clinic search reuses the
 * same tables/filters as /api/search, treatment/concern lookups reuse the
 * canonical taxonomy + editorial catalogs, and page-context lookups read the
 * clinic/provider a page is showing. Everything the assistant ever states as
 * fact originates here — the model only paraphrases these results.
 *
 * SERVER-SIDE ONLY (imports the pg pool).
 */
import pool from "@/lib/db";
import {
  CANONICAL_SERVICES,
  CANONICAL_CONCERNS,
  matchService,
  normalize,
  type CanonicalConcern,
} from "@/lib/taxonomy/canonical";
import { TREATMENT_CATALOG } from "@/lib/treatments/catalog";
import { CONCERN_CATALOG } from "@/lib/concerns/catalog";

// 2-letter state abbreviations → full names as stored in the DB (mirrors /api/search).
export const STATE_ABBR_TO_NAME: Record<string, string> = {
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

// Reverse map (lowercased full name → abbreviation) so "Utah" also matches
// clinics stored as "UT", and vice-versa. State data is a mix of both forms.
export const NAME_TO_ABBR: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_ABBR_TO_NAME).map(([abbr, name]) => [
    name.toLowerCase(),
    abbr,
  ])
);

// ──────────────────────────────────────────────────────────────────────────
// Types (shared with intent/context/route)
// ──────────────────────────────────────────────────────────────────────────
export interface ClinicResult {
  name: string;
  slug: string;
  url: string;
  city: string | null;
  state: string | null;
  rating: number | null;
  reviews: number;
  treatments: string[];
  booking_url: string | null;
}

export interface SearchResult {
  count: number;
  clinics: ClinicResult[];
  filters: { treatment: string | null; location: string | null };
  search_page: string;
  /** true when the DB query threw/timed out (vs. simply returned nothing). */
  unavailable?: boolean;
}

export interface TreatmentInfo {
  found: boolean;
  name?: string;
  slug?: string;
  url?: string;
  category?: string;
  summary?: string;
  treatment_time?: string;
  results_timeline?: string;
  results_duration?: string;
  price_from?: number | null;
  price_unit?: string | null;
  recovery_time?: string | null;
  treats_concerns?: { name: string; slug: string; url: string }[];
}

export interface ConcernInfo {
  found: boolean;
  name?: string;
  slug?: string;
  url?: string;
  overview?: string | null;
  recommended_treatments?: { name: string; slug: string; url: string }[];
}

/** What a page has already loaded, resolved server-side from its slug/id. */
export interface ClinicContext {
  name: string;
  slug: string;
  url: string;
  city: string | null;
  state: string | null;
  rating: number | null;
  reviews: number;
  services: string[];
  hasBooking: boolean;
}

// ──────────────────────────────────────────────────────────────────────────
// searchClinics — real clinic search (mirrors /api/search filters)
// ──────────────────────────────────────────────────────────────────────────
export interface SearchArgs {
  treatment?: string;
  location?: string;
  minRating?: number | null;
  limit?: number;
}

export async function searchClinics(args: SearchArgs): Promise<SearchResult> {
  const treatment = (args.treatment ?? "").trim();
  const location = (args.location ?? "").trim();
  const minRating =
    typeof args.minRating === "number" && Number.isFinite(args.minRating)
      ? args.minRating
      : null;
  const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 8);

  const conditions: string[] = ["c.is_active = TRUE"];
  const params: (string | number)[] = [];
  let i = 1;

  if (treatment) {
    // Match the canonical service slug AND fuzzy raw/scraped names, so we catch
    // clinics whose treatment is only in the raw scraped name (maximizes recall).
    const m = matchService(treatment);
    const like = `%${treatment}%`;
    if (m.slug) {
      conditions.push(`(
        EXISTS (
          SELECT 1 FROM clinic_services cse
          JOIN services se ON se.id = cse.service_id AND se.is_active = TRUE
          WHERE cse.clinic_id = c.id AND cse.is_active = TRUE AND se.slug = $${i}
        )
        OR s.name ILIKE $${i + 1} OR cs.raw_name ILIKE $${i + 1} OR c.name ILIKE $${i + 1}
      )`);
      params.push(m.slug, like);
      i += 2;
    } else {
      conditions.push(`(
        s.name ILIKE $${i} OR cs.raw_name ILIKE $${i} OR c.name ILIKE $${i}
      )`);
      params.push(like);
      i++;
    }
  }

  if (location) {
    const upper = location.toUpperCase();
    let abbr: string | null = null;
    let fullName: string | null = null;
    if (STATE_ABBR_TO_NAME[upper]) {
      abbr = upper;
      fullName = STATE_ABBR_TO_NAME[upper];
    } else if (NAME_TO_ABBR[location.toLowerCase()]) {
      abbr = NAME_TO_ABBR[location.toLowerCase()];
      fullName = STATE_ABBR_TO_NAME[abbr];
    }

    if (abbr && fullName) {
      conditions.push(`(
        EXISTS (
          SELECT 1 FROM clinic_locations cl
          WHERE cl.clinic_id = c.id AND cl.is_active = true
            AND (cl.state = $${i} OR cl.state ILIKE $${i + 1})
        )
      )`);
      params.push(abbr, fullName);
      i += 2;
    } else {
      conditions.push(`(
        EXISTS (
          SELECT 1 FROM clinic_locations cl
          WHERE cl.clinic_id = c.id AND cl.is_active = true
            AND (cl.city ILIKE $${i} OR cl.state ILIKE $${i} OR cl.zip ILIKE $${i})
        )
      )`);
      params.push(`%${location}%`);
      i++;
    }
  }

  if (minRating !== null) {
    conditions.push(`c.avg_rating >= $${i}`);
    params.push(minRating);
    i++;
  }

  const sql = `
    SELECT q.* FROM (
      SELECT DISTINCT ON (c.id)
        c.id, c.slug, c.name, ploc.city, ploc.state, c.avg_rating, c.review_count,
        c.featured, c.booking_url,
        (
          SELECT COALESCE(json_agg(t.name), '[]'::json) FROM (
            SELECT DISTINCT sv.name
            FROM clinic_services cs2
            JOIN services sv ON sv.id = cs2.service_id AND sv.is_active = TRUE
            WHERE cs2.clinic_id = c.id AND cs2.is_active = TRUE
            LIMIT 6
          ) t
        ) AS treatments
      FROM clinics c
      LEFT JOIN clinic_services cs ON cs.clinic_id = c.id AND cs.is_active = TRUE
      LEFT JOIN services s ON s.id = cs.service_id AND s.is_active = TRUE
      LEFT JOIN LATERAL (
        SELECT cl.city, cl.state
        FROM clinic_locations cl
        WHERE cl.clinic_id = c.id AND cl.is_active = true
        ORDER BY cl.is_primary DESC, cl.sort_order NULLS LAST, cl.created_at
        LIMIT 1
      ) ploc ON true
      WHERE ${conditions.join(" AND ")}
      ORDER BY c.id
    ) q
    ORDER BY q.featured DESC, q.avg_rating DESC NULLS LAST, q.review_count DESC
    LIMIT ${limit}
  `;

  // Canonical display name of the searched treatment, if it resolves. Every row
  // in a treatment-filtered result set matched that treatment (via canonical
  // service, raw scraped name, or clinic name), but the top-6 canonical service
  // list we show may not surface it (e.g. Botox offered only under a raw name).
  // Surface it so a "Find Botox clinics" search doesn't read as "none offer Botox".
  const matchedName = treatment
    ? CANONICAL_SERVICES.find((s) => s.slug === matchService(treatment).slug)?.name
    : undefined;

  try {
    const { rows } = await pool.query(sql, params);
    const clinics: ClinicResult[] = rows.map((r) => {
      const svc: string[] = Array.isArray(r.treatments) ? r.treatments : [];
      // Surface the searched treatment FIRST so the trimmed 3-item display never
      // hides it. The clinic matched this treatment, but the top-6 canonical
      // service list is unordered, so the match can otherwise fall outside the
      // visible slice (or be present only under a raw scraped name).
      if (matchedName) {
        const idx = svc.indexOf(matchedName);
        if (idx > -1) svc.splice(idx, 1);
        svc.unshift(matchedName);
      }
      return {
        name: r.name,
        slug: r.slug,
        url: `/clinics/${r.slug}`,
        city: r.city,
        state: r.state,
        rating: r.avg_rating != null ? Number(r.avg_rating) : null,
        reviews: r.review_count ?? 0,
        treatments: svc.slice(0, 6),
        booking_url: r.booking_url ?? null,
      };
    });

    return {
      count: clinics.length,
      clinics,
      filters: { treatment: treatment || null, location: location || null },
      search_page: buildSearchUrl(treatment, location),
    };
  } catch (err) {
    console.error("[chat] searchClinics error:", err);
    return {
      count: 0,
      clinics: [],
      filters: { treatment: treatment || null, location: location || null },
      search_page: buildSearchUrl(treatment, location),
      unavailable: true,
    };
  }
}

export function buildSearchUrl(treatment: string, location: string): string {
  const p = new URLSearchParams();
  if (treatment) p.set("q", treatment);
  if (location) p.set("location", location);
  const qs = p.toString();
  return qs ? `/search?${qs}` : "/search";
}

// ──────────────────────────────────────────────────────────────────────────
// getClinicBySlug — page context for /clinics/[slug] and /providers/[id]/[slug]
// ──────────────────────────────────────────────────────────────────────────
export async function getClinicBySlug(
  slug: string
): Promise<ClinicContext | null> {
  const clean = (slug ?? "").trim();
  if (!clean) return null;
  const sql = `
    SELECT
      c.id, c.slug, c.name, ploc.city, ploc.state, c.avg_rating, c.review_count,
      c.booking_url,
      (
        SELECT COALESCE(json_agg(t.name), '[]'::json) FROM (
          SELECT DISTINCT sv.name
          FROM clinic_services cs2
          JOIN services sv ON sv.id = cs2.service_id AND sv.is_active = TRUE
          WHERE cs2.clinic_id = c.id AND cs2.is_active = TRUE
          LIMIT 12
        ) t
      ) AS services
    FROM clinics c
    LEFT JOIN LATERAL (
      SELECT cl.city, cl.state
      FROM clinic_locations cl
      WHERE cl.clinic_id = c.id AND cl.is_active = true
      ORDER BY cl.is_primary DESC, cl.sort_order NULLS LAST, cl.created_at
      LIMIT 1
    ) ploc ON true
    WHERE c.slug = $1 AND c.is_active = TRUE
    LIMIT 1
  `;
  try {
    const { rows } = await pool.query(sql, [clean]);
    if (!rows.length) return null;
    const r = rows[0];
    return {
      name: r.name,
      slug: r.slug,
      url: `/clinics/${r.slug}`,
      city: r.city,
      state: r.state,
      rating: r.avg_rating != null ? Number(r.avg_rating) : null,
      reviews: r.review_count ?? 0,
      services: Array.isArray(r.services) ? r.services : [],
      hasBooking: Boolean(r.booking_url),
    };
  } catch (err) {
    console.error("[chat] getClinicBySlug error:", err);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// getTreatmentInfo — static taxonomy + catalog lookup (no DB)
// ──────────────────────────────────────────────────────────────────────────
export function getTreatmentInfo(query: string): TreatmentInfo {
  const m = matchService(query || "");
  if (!m.slug) return { found: false };

  const svc = CANONICAL_SERVICES.find((s) => s.slug === m.slug)!;
  const cat = TREATMENT_CATALOG.find((t) => t.slug === m.slug);
  const treatsConcerns = CANONICAL_CONCERNS.filter((c) =>
    c.serviceSlugs.includes(m.slug!)
  ).map((c) => ({ name: c.name, slug: c.slug, url: `/search?condition=${c.slug}` }));

  return {
    found: true,
    name: svc.name,
    slug: svc.slug,
    url: `/search?q=${svc.slug}`,
    category: svc.category,
    summary: svc.summary,
    treatment_time: svc.treatment_time,
    results_timeline: svc.results_timeline,
    results_duration: svc.results_duration,
    price_from: cat?.price_from ?? null,
    price_unit: cat?.price_unit ?? null,
    recovery_time: cat?.recovery_time ?? null,
    treats_concerns: treatsConcerns,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// getConcernInfo — fuzzy concern resolution + catalog overview
// ──────────────────────────────────────────────────────────────────────────
export function resolveConcern(query: string): CanonicalConcern | null {
  const n = normalize(query || "");
  if (!n) return null;

  // Exact name/slug/alias, or substring containment either way.
  for (const c of CANONICAL_CONCERNS) {
    if (normalize(c.name) === n || normalize(c.slug) === n) return c;
    for (const a of c.aliases) {
      const na = normalize(a);
      if (na && (na === n || n.includes(na) || na.includes(n))) return c;
    }
  }

  // Token-overlap fallback.
  const qt = new Set(n.split(" ").filter(Boolean));
  let best: CanonicalConcern | null = null;
  let bestScore = 0;
  for (const c of CANONICAL_CONCERNS) {
    const ct = new Set(
      normalize([c.name, ...c.aliases].join(" ")).split(" ").filter(Boolean)
    );
    let inter = 0;
    for (const t of qt) if (ct.has(t)) inter++;
    const score = inter / Math.max(qt.size, 1);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore >= 0.5 ? best : null;
}

export function getConcernInfo(query: string): ConcernInfo {
  const c = resolveConcern(query || "");
  if (!c) return { found: false };

  const cat = CONCERN_CATALOG.find((x) => x.slug === c.slug);
  const recommended = c.serviceSlugs
    .map((slug) => {
      const s = CANONICAL_SERVICES.find((z) => z.slug === slug);
      return s ? { name: s.name, slug, url: `/search?q=${slug}` } : null;
    })
    .filter((x): x is { name: string; slug: string; url: string } => x !== null);

  return {
    found: true,
    name: c.name,
    slug: c.slug,
    url: `/search?condition=${c.slug}`,
    overview: cat?.overview ?? null,
    recommended_treatments: recommended,
  };
}
