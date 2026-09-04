/**
 * search-adapter.ts — the ONLY way the chatbot is allowed to look up clinics.
 *
 * Why this file exists: the assistant used to carry its own hand-rolled clinic
 * SQL (`data.ts:searchClinics`). It had no geo, no radius, no distance and no
 * concern support, so it substring-matched city names — and "salt lake city"
 * matches no clinic city in the DB even though 20 practices offering Botox sit
 * within 50 miles. The bot confidently answered "none", and the /search link it
 * offered was built from raw user text that the real engine resolves to zero.
 *
 * So chat no longer has a search engine. It builds ONE URLSearchParams and
 * hands it to the same `runSearch` the /search page uses, then reuses that
 * exact same params object as the deep link. Identical inputs in, identical
 * results out — the bot and the site can no longer disagree, by construction.
 *
 * SERVER-SIDE ONLY (reaches the pg pool through the search engine).
 */
import { searchClinics as runSiteSearch } from "@/lib/search/query";
import { resolveSearchQuery, type ResolvedQuery } from "@/lib/search/resolve-query";
import { lookupZip, lookupCityState, searchCity } from "@/lib/location/postal-index";
import { toStateCode, toStateName } from "@/lib/location/states";
import { DEFAULT_ORIGIN_RADIUS_MILES } from "@/lib/search/location-scope";
import type { ClinicResult, SearchResult } from "./data";

/**
 * Hard cap on practice cards in a single chat answer. Not a default — a ceiling.
 * More than five buries the conversation in a 390px panel, and the "See all N
 * results" link already covers the rest.
 */
export const CHAT_RESULT_LIMIT = 5;

// ──────────────────────────────────────────────────────────────────────────
// Location resolution
// ──────────────────────────────────────────────────────────────────────────

export type ChatLocationKind = "zip" | "city" | "state" | "coords" | "text" | "none";

export interface ResolvedChatLocation {
  /** Value for the `location` URL param — null when we only have coordinates. */
  param: string | null;
  /** Human-readable label for the assistant's copy ("Salt Lake City, UT"). */
  label: string | null;
  lat: number | null;
  lng: number | null;
  kind: ChatLocationKind;
}

const NONE: ResolvedChatLocation = {
  param: null,
  label: null,
  lat: null,
  lng: null,
  kind: "none",
};

/** Split "Salt Lake City, UT" / "salt lake city, utah" into [city, stateCode]. */
function splitCityState(raw: string): [string, string] | null {
  const idx = raw.lastIndexOf(",");
  if (idx < 1) return null;
  const city = raw.slice(0, idx).trim();
  const code = toStateCode(raw.slice(idx + 1).trim());
  return city && code ? [city, code] : null;
}

/**
 * Turn whatever the user typed into the same `location` + lat/lng the site's
 * typeahead would have produced, using the in-memory GeoNames index that backs
 * /api/locations/suggest. Pure and synchronous — no network, no DB.
 *
 * The important case is a BARE city name ("salt lake city"): the search engine
 * only geocodes "City, ST" and zips, so a bare city would fall through to a
 * `city ILIKE '%...%'` text match. Resolving it here to "Salt Lake City, UT"
 * plus a centroid is what turns the query into a real 50-mile radius search.
 */
export function resolveChatLocation(
  raw?: string | null,
  coords?: { lat: number; lng: number } | null,
): ResolvedChatLocation {
  const text = (raw ?? "").trim();

  // No place named — fall back to the visitor's own coordinates ("near me").
  if (!text) {
    return coords
      ? { param: null, label: "your location", lat: coords.lat, lng: coords.lng, kind: "coords" }
      : NONE;
  }

  // ZIP → the zip's own point.
  if (/^\d{5}$/.test(text)) {
    const z = lookupZip(text);
    if (z) {
      const label = `${z.city}, ${z.state_code}`;
      return { param: label, label, lat: z.lat, lng: z.lng, kind: "zip" };
    }
    return { param: text, label: text, lat: null, lng: null, kind: "text" };
  }

  // "City, ST" / "City, State".
  const pair = splitCityState(text);
  if (pair) {
    const [city, code] = pair;
    const hit = lookupCityState(city, code);
    if (hit) {
      const label = `${hit.city}, ${hit.state_code}`;
      return { param: label, label, lat: hit.lat, lng: hit.lng, kind: "city" };
    }
    // City unknown to the index. Do NOT pass "City, ST" through as text — it can
    // never ILIKE-match the `city` column, which is a silent zero-result. Widen
    // to the state instead, which always matches something.
    return {
      param: code,
      label: toStateName(code) ?? code,
      lat: null,
      lng: null,
      kind: "state",
    };
  }

  // "provo utah" / "salt lake city utah" — a city with a trailing state and no
  // comma. Very common in speech, and it must not collapse to the whole state.
  const words = text.split(/\s+/);
  if (words.length > 1) {
    for (const take of [2, 1]) {
      if (words.length <= take) continue;
      const code = toStateCode(words.slice(-take).join(" "));
      if (!code) continue;
      const hit = lookupCityState(words.slice(0, -take).join(" "), code);
      if (hit) {
        const label = `${hit.city}, ${hit.state_code}`;
        return { param: label, label, lat: hit.lat, lng: hit.lng, kind: "city" };
      }
    }
  }

  // A bare state ("Utah", "UT") is a statewide text match, deliberately with no
  // origin — mirrors the typeahead, which sends lat:null for state picks rather
  // than a radius around some arbitrary point in the state.
  const stateCode = toStateCode(text);
  if (stateCode) {
    return {
      param: stateCode,
      label: toStateName(stateCode) ?? stateCode,
      lat: null,
      lng: null,
      kind: "state",
    };
  }

  // Bare city name — the case that was broken.
  const [city] = searchCity(text, 1);
  if (city) {
    const label = `${city.city}, ${city.state_code}`;
    return { param: label, label, lat: city.lat, lng: city.lng, kind: "city" };
  }

  // Unrecognised place: let the engine text-match it rather than inventing one.
  return { param: text, label: text, lat: null, lng: null, kind: "text" };
}

// ──────────────────────────────────────────────────────────────────────────
// chatSearch
// ──────────────────────────────────────────────────────────────────────────

export interface ChatSearchInput {
  /** Free text naming a treatment or concern ("botox", "acne scars"). */
  text?: string | null;
  /** Free text naming a place ("salt lake city", "84101", "Utah"). */
  location?: string | null;
  /** Visitor's browser coordinates, used for "near me". */
  coords?: { lat: number; lng: number } | null;
  minRating?: number | null;
  limit?: number;
  /**
   * Replay a previous turn's exact query string instead of resolving fresh
   * filters. Used when the user refers back to the clinics we just listed
   * ("which of those…") so the follow-up can't silently answer about a
   * different result set.
   */
  rawParams?: string | null;
}

export interface ChatNearby {
  total: number;
  nearestMiles: number | null;
  clinics: ClinicResult[];
  /**
   * Link for the RELAXED query that actually found these.
   *
   * It must not be the scoped `search_page`: that one returned nothing, which
   * is why we fell back at all, so offering it as "see all results" would hand
   * the user an empty page right under a list of practices.
   */
  search_page: string;
}

export interface ChatSearchResult extends SearchResult {
  /** Total matches, of which `clinics` holds the first few. */
  total: number;
  resolved: { kind: "treatment" | "concern"; slug: string; name: string } | null;
  /** What the user actually typed, before alias resolution. */
  queryText: string | null;
  location: ResolvedChatLocation;
  /** Farther-away practices, when the scoped search found nothing. */
  nearby?: ChatNearby;
}

/**
 * Rating + review count, taken from the SAME source — exactly as the site's own
 * ClinicCard does (clinic-card.tsx:84-87). They must be paired: most clinics
 * have avg_rating NULL and review_count 0 while the real numbers sit in
 * ext_rating/ext_review_count, so mixing the two yields "5.0 (0 reviews)" and
 * the card then suppresses the rating entirely.
 */
function pickRating(row: Record<string, unknown>): { rating: number | null; reviews: number } {
  const useOwn = row.avg_rating != null;
  const rawRating = useOwn ? row.avg_rating : row.ext_rating;
  const rawReviews = useOwn ? row.review_count : row.ext_review_count;
  return {
    rating:
      rawRating != null && Number.isFinite(Number(rawRating)) ? Number(rawRating) : null,
    reviews:
      rawReviews != null && Number.isFinite(Number(rawReviews)) ? Number(rawReviews) : 0,
  };
}

/** Map an engine row onto the shape the assistant + chat cards consume. */
function toClinicResult(
  row: Record<string, unknown>,
  matchedName: string | null,
): ClinicResult {
  const services = Array.isArray(row.services)
    ? (row.services as { name?: string }[]).map((s) => s?.name).filter((n): n is string => !!n)
    : [];

  // Surface the searched treatment first so the trimmed display never hides the
  // very thing that was asked for.
  if (matchedName) {
    const i = services.indexOf(matchedName);
    if (i > -1) services.splice(i, 1);
    services.unshift(matchedName);
  }

  const distance = row.distance_miles;
  const { rating, reviews } = pickRating(row);

  return {
    name: String(row.clinic_name ?? ""),
    slug: String(row.clinic_slug ?? ""),
    url: `/practices/${row.clinic_slug}`,
    city: (row.city as string) ?? null,
    state: (row.state as string) ?? null,
    rating,
    reviews,
    treatments: services.slice(0, 6),
    booking_url: (row.booking_url as string) ?? null,
    logo_url: (row.logo_url as string) ?? null,
    cover_image_url: (row.cover_image_url as string) ?? null,
    distance_miles:
      distance != null && Number.isFinite(Number(distance)) ? Number(distance) : null,
  };
}

/**
 * Run a clinic search through the site's own engine and return both the
 * results and the /search URL that reproduces them exactly.
 */
export async function chatSearch(input: ChatSearchInput): Promise<ChatSearchResult> {
  const text = (input.text ?? "").trim();
  const limit = Math.min(Math.max(input.limit ?? CHAT_RESULT_LIMIT, 1), CHAT_RESULT_LIMIT);
  const location = resolveChatLocation(input.location, input.coords);

  // ── Resolve the treatment/concern up front ───────────────────────────────
  // The engine would resolve it anyway, but we need the canonical slug here so
  // the deep link carries `q=botox` rather than the user's raw phrasing (which
  // the engine deliberately resolves to zero results).
  let resolved: ResolvedQuery = { kind: "unresolved" };
  if (text) {
    try {
      resolved = await resolveSearchQuery(text);
    } catch {
      resolved = { kind: "unresolved" };
    }
  }

  const params = input.rawParams
    ? new URLSearchParams(input.rawParams)
    : new URLSearchParams();

  if (!input.rawParams) {
    if (resolved.kind === "treatment") params.set("q", resolved.slug);
    else if (resolved.kind === "concern") params.set("condition", resolved.slug);

    if (location.param) params.set("location", location.param);
    if (location.lat != null && location.lng != null) {
      params.set("lat", location.lat.toFixed(6));
      params.set("lng", location.lng.toFixed(6));
      // The engine applies its radius filter only for an EXPLICIT radius or an
      // origin it geocoded from `location` itself. Browser coords arrive with no
      // `location`, so without this the scope silently falls back to "national"
      // and "near me" would return clinics from across the country.
      if (!location.param) params.set("radius", String(DEFAULT_ORIGIN_RADIUS_MILES));
    }
    if (input.minRating != null) params.set("rating", String(input.minRating));
  }
  // Our page size is an implementation detail; it must not leak into the link.
  params.delete("limit");
  params.delete("page");

  // The link a human clicks should reproduce the answer, so it carries the same
  // filters — but not our internal page size.
  const search_page = params.toString() ? `/search?${params.toString()}` : "/search";

  const resolvedEcho =
    resolved.kind === "unresolved"
      ? null
      : { kind: resolved.kind, slug: resolved.slug, name: resolved.name };

  const filters = {
    treatment: resolvedEcho?.name ?? (text || null),
    location: location.label,
  };

  const queryParams = new URLSearchParams(params);
  queryParams.set("limit", String(limit));
  queryParams.set("page", "1");

  try {
    const payload = await runSiteSearch(queryParams);
    const matchedName = resolvedEcho?.kind === "treatment" ? resolvedEcho.name : null;
    const clinics = payload.results.map((r) => toClinicResult(r, matchedName));

    let nearby: ChatNearby | undefined;
    if (payload.nearby) {
      // Mirror the engine's own relaxation (query.ts findNearbyFallback):
      // drop the geographic filter, keep the origin so results stay
      // distance-sorted.
      const relaxed = new URLSearchParams(params);
      relaxed.delete("location");
      relaxed.delete("radius");
      nearby = {
        total: payload.nearby.total,
        nearestMiles: payload.nearby.nearestMiles,
        clinics: payload.nearby.results
          .slice(0, CHAT_RESULT_LIMIT)
          .map((r) => toClinicResult(r, matchedName)),
        search_page: relaxed.toString() ? `/search?${relaxed.toString()}` : "/search",
      };
    }

    return {
      count: clinics.length,
      total: payload.total,
      clinics,
      filters,
      search_page,
      resolved: resolvedEcho,
      queryText: text || null,
      location,
      nearby,
    };
  } catch (err) {
    console.error("[chat] chatSearch error:", err);
    return {
      count: 0,
      total: 0,
      clinics: [],
      filters,
      search_page,
      resolved: resolvedEcho,
      queryText: text || null,
      location,
      unavailable: true,
    };
  }
}
