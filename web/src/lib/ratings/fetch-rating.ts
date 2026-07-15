/**
 * ratings/fetch-rating.ts — get a clinic's external rating + review count.
 *
 * Two sources, tried in order:
 *   1. FREE — scrape the clinic's own website for schema.org AggregateRating
 *      (JSON-LD or microdata). Many sites embed this for Google's rich
 *      snippets, so it's the same number Google would show us — for free.
 *   2. FALLBACK — Google Places API (New), only if GOOGLE_PLACES_API_KEY is
 *      set. Costs $0 for the first 1,000 Enterprise-tier calls/month; skipped
 *      entirely (not an error) when no key is configured.
 *
 * Neither source is guaranteed — many clinics will have no rating from
 * either. Callers must treat a null result as "not available", not a failure.
 */

export interface RatingResult {
  rating: number;
  reviewCount: number | null;
  source: "website" | "google_places";
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// ── Source 1: website JSON-LD / microdata ───────────────────────────────────

/** Recursively search a parsed JSON-LD document for an AggregateRating node. */
function findAggregateRating(node: unknown): { ratingValue?: unknown; reviewCount?: unknown } | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findAggregateRating(item);
      if (hit) return hit;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  const isAggregateRating =
    type === "AggregateRating" || (Array.isArray(type) && type.includes("AggregateRating"));
  if (isAggregateRating && obj["ratingValue"] != null) return obj;
  if (obj["aggregateRating"]) {
    const hit = findAggregateRating(obj["aggregateRating"]);
    if (hit) return hit;
  }
  // @graph and arbitrary nesting (Product, LocalBusiness, etc.)
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      const hit = findAggregateRating(value);
      if (hit) return hit;
    }
  }
  return null;
}

function parseRatingFromJsonLd(html: string): RatingResult | null {
  const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(html))) {
    let data: unknown;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const hit = findAggregateRating(data);
    if (hit) {
      const rating = Number(hit.ratingValue);
      if (!Number.isFinite(rating)) continue;
      const countRaw = hit.reviewCount;
      const reviewCount = countRaw != null && Number.isFinite(Number(countRaw)) ? Number(countRaw) : null;
      return { rating, reviewCount, source: "website" };
    }
  }
  return null;
}

function parseRatingFromMicrodata(html: string): RatingResult | null {
  const rv = html.match(/itemprop=["']ratingValue["'][^>]*content=["']([\d.]+)["']/i);
  if (!rv) return null;
  const rating = Number(rv[1]);
  if (!Number.isFinite(rating)) return null;
  const rc = html.match(/itemprop=["']reviewCount["'][^>]*content=["'](\d+)["']/i);
  return { rating, reviewCount: rc ? Number(rc[1]) : null, source: "website" };
}

/** Try to read a published rating off the clinic's own homepage. Free, no key. */
export async function fetchRatingFromWebsite(url: string): Promise<RatingResult | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    return parseRatingFromJsonLd(html) ?? parseRatingFromMicrodata(html);
  } catch {
    return null;
  }
}

// ── Source 2: Google Places API (New) — fallback, costs $ beyond free tier ──

interface PlacesTextSearchResponse {
  places?: Array<{ rating?: number; userRatingCount?: number; id?: string }>;
}

/**
 * Look up rating + review count via Google Places API (New).
 * - If `placeId` is known, uses Place Details (Enterprise SKU, $20/1000 after
 *   1,000 free/month).
 * - Otherwise, falls back to Text Search by name+address (Enterprise SKU,
 *   $35/1000 after its own separate 1,000 free/month).
 * Returns null (not a throw) when GOOGLE_PLACES_API_KEY is unset, so callers
 * can treat "no fallback configured" the same as "fallback found nothing".
 */
export async function fetchRatingFromGooglePlaces(opts: {
  placeId?: string | null;
  query?: string | null; // e.g. "RUMA Medical, Lehi, UT"
}): Promise<RatingResult | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  try {
    if (opts.placeId) {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(opts.placeId)}`,
        {
          headers: {
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "rating,userRatingCount",
          },
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { rating?: number; userRatingCount?: number };
      if (typeof data.rating !== "number") return null;
      return {
        rating: data.rating,
        reviewCount: typeof data.userRatingCount === "number" ? data.userRatingCount : null,
        source: "google_places",
      };
    }

    if (opts.query) {
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "places.rating,places.userRatingCount,places.id",
        },
        body: JSON.stringify({ textQuery: opts.query }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as PlacesTextSearchResponse;
      const place = data.places?.[0];
      if (!place || typeof place.rating !== "number") return null;
      return {
        rating: place.rating,
        reviewCount: typeof place.userRatingCount === "number" ? place.userRatingCount : null,
        source: "google_places",
      };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Full resolution: free website scrape first, Google Places fallback second.
 * `query` should be a human search string like "Clinic Name, City, ST" for
 * the Text Search fallback when no `placeId` is stored yet.
 */
export async function resolveClinicRating(opts: {
  website: string | null;
  placeId?: string | null;
  query?: string | null;
}): Promise<RatingResult | null> {
  if (opts.website) {
    const fromSite = await fetchRatingFromWebsite(opts.website);
    if (fromSite) return fromSite;
  }
  return fetchRatingFromGooglePlaces({ placeId: opts.placeId, query: opts.query });
}
