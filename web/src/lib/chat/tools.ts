/**
 * tools.ts — function-calling tools for the chatbot.
 *
 * Each tool is grounded in real Medspa Map data: the clinic search reuses the
 * same tables/filters as /api/search, and treatment/concern lookups reuse the
 * canonical taxonomy + editorial catalogs. This keeps the bot's answers
 * accurate and lets it return real, clickable deep links instead of
 * hallucinating clinics.
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
const STATE_ABBR_TO_NAME: Record<string, string> = {
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

// Reverse map (lowercased full name → abbreviation) so a user/model saying
// "Utah" also matches clinics stored as "UT", and vice-versa. State data in the
// DB is inconsistent (mix of 2-letter codes and full names).
const NAME_TO_ABBR: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_ABBR_TO_NAME).map(([abbr, name]) => [
    name.toLowerCase(),
    abbr,
  ])
);

// ──────────────────────────────────────────────────────────────────────────
// OpenAI-compatible tool definitions sent to OpenRouter
// ──────────────────────────────────────────────────────────────────────────
export const TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "search_clinics",
      description:
        "Find real medspa clinics in the Medspa Map directory by treatment and/or location. Use this whenever the user wants to find, recommend, or compare clinics, or asks about clinics 'near me' / in a place. Returns real clinics with ratings and clickable links.",
      parameters: {
        type: "object",
        properties: {
          treatment: {
            type: "string",
            description:
              "Treatment or service to filter by, e.g. 'Botox', 'laser hair removal', 'CoolSculpting'. Optional.",
          },
          location: {
            type: "string",
            description:
              "City, state name, 2-letter state code, or ZIP, e.g. 'Austin', 'Texas', 'TX', '78701'. Optional but strongly preferred for relevant results.",
          },
          min_rating: {
            type: "number",
            description: "Minimum average star rating, 0-5. Optional.",
          },
          limit: {
            type: "integer",
            description: "Max clinics to return (1-8, default 5).",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_treatment_info",
      description:
        "Get factual details about a specific treatment in the Medspa Map catalog (summary, description, typical cost, treatment time, results, recovery, and which concerns it treats). Use for any question about a treatment.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Treatment name or related term, e.g. 'Botox', 'filler', 'morpheus8', 'microneedling'.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_concern_info",
      description:
        "Get info about a skin/body concern in the Medspa Map catalog and the treatments that address it. Use when a user describes a goal or problem like 'acne scars', 'double chin', 'wrinkles', 'sagging skin', 'sun spots'.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Concern or goal, e.g. 'acne scars', 'wrinkles', 'double chin', 'rosacea', 'tighten loose skin'.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_treatments",
      description:
        "List every treatment the Medspa Map directory covers, with links. Use when the user asks what treatments/services are available.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_concerns",
      description:
        "List every skin/body concern the Medspa Map directory covers, with links. Use when the user asks what concerns/conditions are covered.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
] as const;

// ──────────────────────────────────────────────────────────────────────────
// Dispatcher
// ──────────────────────────────────────────────────────────────────────────
export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "search_clinics":
      return searchClinics(args);
    case "get_treatment_info":
      return getTreatmentInfo(args);
    case "get_concern_info":
      return getConcernInfo(args);
    case "list_treatments":
      return listTreatments();
    case "list_concerns":
      return listConcerns();
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// search_clinics
// ──────────────────────────────────────────────────────────────────────────
async function searchClinics(args: Record<string, unknown>) {
  const treatment =
    typeof args.treatment === "string" ? args.treatment.trim() : "";
  const location =
    typeof args.location === "string" ? args.location.trim() : "";
  const minRating =
    typeof args.min_rating === "number" && Number.isFinite(args.min_rating)
      ? args.min_rating
      : null;
  const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 8);

  const conditions: string[] = ["c.is_active = TRUE", "b.is_active = TRUE"];
  const params: (string | number)[] = [];
  let i = 1;

  if (treatment) {
    // Match the canonical service slug AND fuzzy raw/scraped names, so we catch
    // clinics whose treatment is only in the raw scraped name (maximizes recall
    // — a concierge should surface results, not under-match).
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
    // Resolve to a (abbr, full name) pair when the location is a state, so
    // "Utah", "UT", and "utah" all match clinics stored either way.
    const upper = location.toUpperCase();
    let abbr: string | null = null;
    let fullName: string | null = null;
    if (STATE_ABBR_TO_NAME[upper]) {
      abbr = upper;
      fullName = STATE_ABBR_TO_NAME[upper];
    } else if (NAME_TO_ABBR[location.trim().toLowerCase()]) {
      abbr = NAME_TO_ABBR[location.trim().toLowerCase()];
      fullName = STATE_ABBR_TO_NAME[abbr];
    }

    if (abbr && fullName) {
      conditions.push(`(
        c.state = $${i} OR c.state ILIKE $${i + 1}
        OR EXISTS (
          SELECT 1 FROM clinic_locations cl
          WHERE cl.clinic_id = c.id AND cl.is_active = true
            AND (cl.state = $${i} OR cl.state ILIKE $${i + 1})
        )
      )`);
      params.push(abbr, fullName);
      i += 2;
    } else {
      conditions.push(`(
        c.city ILIKE $${i} OR c.state ILIKE $${i} OR c.zip ILIKE $${i}
        OR EXISTS (
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

  // DISTINCT ON dedups multi-service joins; the outer query sorts the deduped
  // rows by quality so LIMIT keeps the best clinics (not the lowest ids).
  const sql = `
    SELECT q.* FROM (
      SELECT DISTINCT ON (c.id)
        c.id, c.slug, c.name, c.city, c.state, c.avg_rating, c.review_count,
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
      JOIN businesses b ON b.id = c.business_id
      LEFT JOIN clinic_services cs ON cs.clinic_id = c.id AND cs.is_active = TRUE
      LEFT JOIN services s ON s.id = cs.service_id AND s.is_active = TRUE
      WHERE ${conditions.join(" AND ")}
      ORDER BY c.id
    ) q
    ORDER BY q.featured DESC, q.avg_rating DESC NULLS LAST, q.review_count DESC
    LIMIT ${limit}
  `;

  try {
    const { rows } = await pool.query(sql, params);
    const clinics = rows.map((r) => ({
      name: r.name,
      url: `/clinics/${r.slug}`,
      city: r.city,
      state: r.state,
      rating: r.avg_rating != null ? Number(r.avg_rating) : null,
      reviews: r.review_count ?? 0,
      treatments: Array.isArray(r.treatments) ? r.treatments : [],
      booking_url: r.booking_url ?? null,
    }));

    return {
      count: clinics.length,
      clinics,
      filters: { treatment: treatment || null, location: location || null },
      search_page: buildSearchUrl(treatment, location),
      note:
        clinics.length === 0
          ? "No clinics matched. Suggest the user broaden the location or try a different treatment."
          : undefined,
    };
  } catch (err) {
    console.error("[chat] search_clinics error:", err);
    return { error: "Clinic search is temporarily unavailable." };
  }
}

function buildSearchUrl(treatment: string, location: string): string {
  const p = new URLSearchParams();
  if (treatment) p.set("q", treatment);
  if (location) p.set("location", location);
  const qs = p.toString();
  return qs ? `/search?${qs}` : "/search";
}

// ──────────────────────────────────────────────────────────────────────────
// get_treatment_info
// ──────────────────────────────────────────────────────────────────────────
function getTreatmentInfo(args: Record<string, unknown>) {
  const query = typeof args.query === "string" ? args.query : "";
  const m = matchService(query);
  if (!m.slug) {
    return {
      found: false,
      message: `"${query}" isn't in the Medspa Map catalog.`,
      available_treatments: CANONICAL_SERVICES.map((s) => s.name),
    };
  }
  const svc = CANONICAL_SERVICES.find((s) => s.slug === m.slug)!;
  const cat = TREATMENT_CATALOG.find((t) => t.slug === m.slug);
  const treatsConcerns = CANONICAL_CONCERNS.filter((c) =>
    c.serviceSlugs.includes(m.slug!)
  ).map((c) => ({ name: c.name, url: `/conditions/${c.slug}` }));

  return {
    found: true,
    name: svc.name,
    url: `/treatments/${svc.slug}`,
    category: svc.category,
    summary: svc.summary,
    description: svc.description,
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
// get_concern_info
// ──────────────────────────────────────────────────────────────────────────
function resolveConcern(query: string): CanonicalConcern | null {
  const n = normalize(query);
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

function getConcernInfo(args: Record<string, unknown>) {
  const query = typeof args.query === "string" ? args.query : "";
  const c = resolveConcern(query);
  if (!c) {
    return {
      found: false,
      message: `"${query}" isn't a concern in the Medspa Map catalog.`,
      available_concerns: CANONICAL_CONCERNS.map((x) => x.name),
    };
  }
  const cat = CONCERN_CATALOG.find((x) => x.slug === c.slug);
  const recommended = c.serviceSlugs
    .map((slug) => {
      const s = CANONICAL_SERVICES.find((z) => z.slug === slug);
      return s ? { name: s.name, url: `/treatments/${slug}` } : null;
    })
    .filter(Boolean);

  return {
    found: true,
    name: c.name,
    url: `/conditions/${c.slug}`,
    overview: cat?.overview ?? null,
    recommended_treatments: recommended,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// list_treatments / list_concerns
// ──────────────────────────────────────────────────────────────────────────
function listTreatments() {
  return {
    treatments: CANONICAL_SERVICES.map((s) => ({
      name: s.name,
      category: s.category,
      summary: s.summary,
      url: `/treatments/${s.slug}`,
    })),
  };
}

function listConcerns() {
  return {
    concerns: CANONICAL_CONCERNS.map((c) => ({
      name: c.name,
      url: `/conditions/${c.slug}`,
    })),
  };
}
