/**
 * catalog.ts — the assistant's view of the LIVE treatment/concern catalog.
 *
 * The chatbot used to recognise only the 15 curated services and 17 curated
 * concerns in `taxonomy/canonical.ts`. The live catalog holds 966 active
 * services and 191 active concerns, so the bot was blind to roughly 95% of what
 * the site actually offers and would tell people a real treatment "isn't
 * covered".
 *
 * This module loads the whole catalog once per process (5-minute TTL,
 * single-flight) and exposes:
 *   - a normalized name/slug index for O(1) span lookups during intent extraction
 *   - a short, count-ranked sample for the prompt (never the full 966 — that
 *     would be tens of KB and would read as a whitelist)
 *
 * SERVER-SIDE ONLY.
 */
import pool from "@/lib/db";
import { normalize } from "@/lib/taxonomy/canonical";
import { getSearchOptionCounts } from "@/lib/search/option-counts";

export interface CatalogRow {
  slug: string;
  name: string;
}

export interface CatalogEntry {
  kind: "treatment" | "concern";
  slug: string;
  name: string;
}

export interface LiveCatalog {
  serviceCount: number;
  concernCount: number;
  /** normalized name/slug → entry. Treatments win ties (the commoner intent). */
  byNorm: Map<string, CatalogEntry>;
  /** Longest catalog name, in tokens — caps how wide a span we bother testing. */
  maxTokens: number;
  /** Most-offered treatments/concerns, for the prompt sample. */
  topTreatments: { slug: string; name: string; count: number }[];
  topConcerns: { slug: string; name: string; count: number }[];
  loadedAt: number;
}

const TTL_MS = 5 * 60 * 1000;
const TOP_TREATMENTS = 15;
const TOP_CONCERNS = 12;

let cached: LiveCatalog | null = null;
/** Single-flight: 20 concurrent turns must not fire 20 catalog loads. */
let inflight: Promise<LiveCatalog> | null = null;

const EMPTY: LiveCatalog = {
  serviceCount: 0,
  concernCount: 0,
  byNorm: new Map(),
  maxTokens: 1,
  topTreatments: [],
  topConcerns: [],
  loadedAt: 0,
};

async function load(): Promise<LiveCatalog> {
  const [services, concerns] = await Promise.all([
    pool.query<CatalogRow>(
      // Same dental exclusion the search engine applies, so the bot can never
      // recognise something the search would refuse to return.
      `SELECT slug, name FROM services
        WHERE is_active = TRUE AND name !~* '(dentistry|dental|orthodont|veneer)'`,
    ),
    pool.query<CatalogRow>(`SELECT slug, name FROM concerns WHERE is_active = TRUE`),
  ]);

  const byNorm = new Map<string, CatalogEntry>();
  let maxTokens = 1;

  const add = (kind: "treatment" | "concern", rows: CatalogRow[]) => {
    for (const r of rows) {
      if (!r.slug || !r.name) continue;
      const entry: CatalogEntry = { kind, slug: r.slug, name: r.name };
      for (const key of [normalize(r.name), normalize(r.slug.replace(/-/g, " "))]) {
        if (!key || key.length < 3) continue;
        // Treatments are added first and must not be displaced by a concern
        // that happens to share a name.
        if (!byNorm.has(key)) byNorm.set(key, entry);
        const tokens = key.split(/\s+/).length;
        if (tokens > maxTokens) maxTokens = tokens;
      }
    }
  };
  add("treatment", services.rows);
  add("concern", concerns.rows);

  // Counts come from the same builder that feeds the search dropdown, so any
  // number the assistant quotes equals what a click on that option returns.
  let topTreatments: LiveCatalog["topTreatments"] = [];
  let topConcerns: LiveCatalog["topConcerns"] = [];
  try {
    const counts = await getSearchOptionCounts(new URLSearchParams());
    topTreatments = counts.treatments.slice(0, TOP_TREATMENTS);
    topConcerns = counts.concerns.slice(0, TOP_CONCERNS);
  } catch (err) {
    console.error("[chat] catalog counts unavailable:", err);
  }

  return {
    serviceCount: services.rows.length,
    concernCount: concerns.rows.length,
    byNorm,
    maxTokens: Math.min(maxTokens, 6),
    topTreatments,
    topConcerns,
    loadedAt: Date.now(),
  };
}

/** The live catalog, cached. Never throws — a failure degrades to the curated set. */
export async function getLiveCatalog(): Promise<LiveCatalog> {
  if (cached && Date.now() - cached.loadedAt < TTL_MS) return cached;
  if (inflight) return inflight;

  inflight = load()
    .then((c) => {
      cached = c;
      return c;
    })
    .catch((err) => {
      console.error("[chat] catalog load failed:", err);
      return cached ?? EMPTY;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "near", "what", "which", "does", "are", "can",
  "you", "your", "clinic", "clinics", "medspa", "medspas", "practice",
  "practices", "provider", "providers", "place", "places", "best", "good",
  "find", "show", "get", "any", "all", "how", "who", "where", "about",
  "treatment", "treatments", "help", "there", "here", "want", "need", "look",
]);

/**
 * Find every catalog treatment/concern named anywhere in a message.
 *
 * Longest-span-wins over contiguous token n-grams, so "laser hair removal"
 * beats a bare "laser". Pure map lookups — one turn costs a few hundred
 * `Map.get` calls, not a query.
 */
export function matchCatalogEntities(
  message: string,
  catalog: LiveCatalog,
): { treatments: CatalogEntry[]; concerns: CatalogEntry[] } {
  const tokens = normalize(message).split(/\s+/).filter(Boolean);
  const treatments: CatalogEntry[] = [];
  const concerns: CatalogEntry[] = [];
  const seen = new Set<string>();
  const consumed = new Array<boolean>(tokens.length).fill(false);

  for (let width = Math.min(catalog.maxTokens, tokens.length); width >= 1; width--) {
    for (let i = 0; i + width <= tokens.length; i++) {
      if (consumed.slice(i, i + width).some(Boolean)) continue;

      const span = tokens.slice(i, i + width).join(" ");
      if (span.length < 3) continue;
      // A single common word is never a treatment name, whatever the catalog says.
      if (width === 1 && STOPWORDS.has(span)) continue;

      const hit = catalog.byNorm.get(span);
      if (!hit) continue;

      for (let k = i; k < i + width; k++) consumed[k] = true;
      const key = `${hit.kind}:${hit.slug}`;
      if (seen.has(key)) continue;
      seen.add(key);
      (hit.kind === "treatment" ? treatments : concerns).push(hit);
    }
  }

  return { treatments, concerns };
}
