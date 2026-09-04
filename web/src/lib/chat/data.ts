/**
 * data.ts — server-side data retrieval for the AI assistant.
 *
 * These are plain functions the backend calls directly (NOT model-invoked
 * tools). Each is grounded in real Medspa Maps data: treatment/concern lookups
 * reuse the canonical taxonomy + editorial catalogs, and page-context lookups
 * read the clinic a page is showing. Everything the assistant ever states as
 * fact originates here — the model only paraphrases these results.
 *
 * Clinic SEARCH deliberately does NOT live here: it goes through
 * `search-adapter.ts`, which calls the site's own search engine so the bot and
 * the /search page can never disagree. See that file for why.
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
  /** Card fields — populated by the search adapter, absent on page-context lookups. */
  logo_url?: string | null;
  cover_image_url?: string | null;
  distance_miles?: number | null;
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
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviews: number;
  services: string[];
  hasBooking: boolean;
  /** "Mon–Fri 9:00 AM–5:00 PM; Sat closed" — already formatted for reading. */
  hours: string | null;
  tagline: string | null;
  about: string | null;
  /** How many active locations this practice has, so we can say "3 locations". */
  locationCount: number;
}

// ──────────────────────────────────────────────────────────────────────────
// getClinicBySlug — page context for /practices/[slug] and /providers/[id]/[slug]
// ──────────────────────────────────────────────────────────────────────────
const DAY_ORDER = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

const DAY_LABEL: Record<string, string> = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
};

/** "09:00" → "9:00 AM". Returns the input unchanged if it isn't HH:MM. */
function to12h(t: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return t;
  const h = Number(m[1]);
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${suffix}`;
}

/**
 * Format the stored `hours` jsonb into one readable line.
 *
 * Consecutive days with identical hours are collapsed ("Mon–Fri 9:00 AM–5:00 PM")
 * so the assistant can read them out without listing seven lines.
 */
export function formatHours(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const hours = raw as Record<
    string,
    { open?: string | null; close?: string | null; is_open?: boolean } | undefined
  >;

  const parts: { label: string; value: string }[] = [];
  for (const day of DAY_ORDER) {
    const d = hours[day];
    if (!d) continue;
    const value =
      d.is_open && d.open && d.close
        ? `${to12h(d.open)}–${to12h(d.close)}`
        : "closed";
    parts.push({ label: DAY_LABEL[day], value });
  }
  if (!parts.length) return null;

  // Collapse runs of identical values.
  const runs: { from: string; to: string; value: string }[] = [];
  for (const p of parts) {
    const last = runs[runs.length - 1];
    if (last && last.value === p.value) last.to = p.label;
    else runs.push({ from: p.label, to: p.label, value: p.value });
  }

  return runs
    .map((r) => `${r.from === r.to ? r.from : `${r.from}–${r.to}`} ${r.value}`)
    .join("; ");
}

export async function getClinicBySlug(
  slug: string
): Promise<ClinicContext | null> {
  const clean = (slug ?? "").trim();
  if (!clean) return null;
  const sql = `
    SELECT
      c.id, c.slug, c.name, c.avg_rating, c.review_count,
      c.ext_rating, c.ext_review_count,
      c.booking_url, c.phone, c.website, c.hours, c.tagline, c.about,
      c.address AS clinic_address,
      ploc.city, ploc.state, ploc.address AS loc_address,
      ploc.phone AS loc_phone, ploc.hours AS loc_hours,
      (
        SELECT count(*) FROM clinic_locations cl2
        WHERE cl2.clinic_id = c.id AND cl2.is_active = true
      ) AS location_count,
      (
        SELECT COALESCE(json_agg(t.name), '[]'::json) FROM (
          SELECT DISTINCT sv.name
          FROM clinic_services cs2
          JOIN services sv ON sv.id = cs2.service_id AND sv.is_active = TRUE
          WHERE cs2.clinic_id = c.id AND cs2.is_active = TRUE
          LIMIT 24
        ) t
      ) AS services
    FROM clinics c
    LEFT JOIN LATERAL (
      SELECT cl.city, cl.state, cl.address, cl.phone, cl.hours
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

    // Rating and count must come from the SAME source. Most practices have
    // avg_rating NULL and review_count 0 with the real figures in ext_* —
    // mixing them yields "5.0 (0 reviews)", which the UI then suppresses.
    const useOwn = r.avg_rating != null;
    const rawRating = useOwn ? r.avg_rating : r.ext_rating;
    const rawReviews = useOwn ? r.review_count : r.ext_review_count;

    return {
      name: r.name,
      slug: r.slug,
      url: `/practices/${r.slug}`,
      city: r.city ?? null,
      state: r.state ?? null,
      address: r.loc_address ?? r.clinic_address ?? null,
      phone: r.loc_phone ?? r.phone ?? null,
      website: r.website ?? null,
      rating: rawRating != null ? Number(rawRating) : null,
      reviews: rawReviews != null ? Number(rawReviews) : 0,
      services: Array.isArray(r.services) ? r.services : [],
      hasBooking: Boolean(r.booking_url),
      hours: formatHours(r.loc_hours) ?? formatHours(r.hours),
      tagline: r.tagline ?? null,
      about: typeof r.about === "string" ? r.about.slice(0, 600) : null,
      locationCount: Number(r.location_count ?? 1),
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
