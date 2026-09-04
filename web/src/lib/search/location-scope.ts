import { lookupZip, lookupCityState } from "@/lib/location/postal-index";

/**
 * Shared location/taxonomy scoping for the search engine (`query.ts`) and the
 * dropdown-count endpoint (`/api/search-options`).
 *
 * Both need the SAME answer to "which clinics are in play?", or the count shown
 * next to an option would not match the `total` the user gets after picking it.
 * Everything here is pure (no DB): the postal lookups are served from the
 * in-memory GeoNames index.
 */

// Maps 2-letter state abbreviations to full names as stored in the DB
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
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};

// Reverse: FULL STATE NAME (upper-cased) → 2-letter abbreviation. Lets the
// location search resolve a typed full name ("California") the same as "CA".
export const STATE_NAME_TO_ABBR: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_ABBR_TO_NAME).map(([abbr, name]) => [name.toUpperCase(), abbr])
);

// Broad concern → specific child concern slugs. Searching a broad concern also
// returns clinics tagged with the narrower children. Kept in sync with the
// AI-grown concern catalog after the 2026-07-13 cleanup (see scripts/clean-catalog-junk.ts).
export const BROAD_CONCERN_CHILDREN: Record<string, string[]> = {
  "fine-lines-wrinkles": [
    "forehead-lines",
    "frown-lines",
    "crows-feet",
    "bunny-lines",
    "marionette-lines",
    "nasolabial-folds",
    "smile-lines",
    "lip-flip",
  ],
  "skin-laxity-sagging": [
    "brow-lift",
    "jawline",
    "masseter-tmj-face-slimming",
    "platysma-vertical-neck-cords",
  ],
};

/** A concern slug plus its broad→child expansion, deduped. */
export function conditionSlugSet(slug: string): string[] {
  const clean = slug.trim();
  return [...new Set([clean, ...(BROAD_CONCERN_CHILDREN[clean] ?? [])])];
}

/** Default radius (miles) for an origin that came from a typed zip / "City, ST". */
export const DEFAULT_ORIGIN_RADIUS_MILES = 50;

/**
 * Resolve a typed location string to coordinates using the in-memory postal
 * index (src/data/postal-codes-us.json — no DB round-trip). Handles "37203"
 * (zip), "37203, TN" / "37203 TN" (zip + state — e.g. from a booking form
 * autofill), and "Nashville, TN" (city, state). Plain city names stay on the
 * text-match path — the typeahead UI sends lat/lng when a suggestion is picked.
 */
export function resolveTypedLocation(
  location: string,
): { lat: number; lng: number } | null {
  const trimmed = location.trim();

  // "37203" — plain zip
  const zipOnly = trimmed.match(/^(\d{5})$/);
  if (zipOnly) {
    const hit = lookupZip(zipOnly[1]);
    return hit ? { lat: hit.lat, lng: hit.lng } : null;
  }

  // "37203, TN" / "37203 TN" / "37203, Tennessee" — zip with a state alongside.
  // The state just confirms/disambiguates; the zip's own coordinates win.
  const zipState = trimmed.match(/^(\d{5})\s*,?\s*([A-Za-z .]{2,})$/);
  if (zipState) {
    const hit = lookupZip(zipState[1]);
    if (hit) return { lat: hit.lat, lng: hit.lng };
    // Zip not in our index but well-formed — falling through to the "City, ST"
    // branch would be wrong (it's digits), so just miss.
    return null;
  }

  // "City, ST" / "City, StateName" — specific enough to geocode locally.
  const cityState = trimmed.match(/^(.+?)\s*,\s*([A-Za-z .]{2,})$/);
  if (cityState) {
    const hit = lookupCityState(cityState[1], cityState[2]);
    if (hit) return { lat: hit.lat, lng: hit.lng };
  }
  return null;
}

/**
 * Which clinics a search is restricted to, once the location inputs are read.
 *
 * `origin` is used ONLY when a radius hard-filter actually applies. A bare
 * browser-geolocation origin (lat/lng with no radius and no typed location)
 * resolves to `national`, because in that case the engine sorts by distance but
 * never hides a clinic — so a location-scoped count would understate the truth.
 */
export type LocationScope =
  | { kind: "origin"; lat: number; lng: number; radiusMiles: number }
  | { kind: "state"; abbr: string; fullName: string }
  | { kind: "text"; term: string }
  | { kind: "national" };

/** Coordinates the engine measures distance from, when it has any. */
export interface SearchOrigin {
  lat: number;
  lng: number;
}

export interface ResolvedLocation {
  /** Origin for distance display/sort — present even when no radius applies. */
  origin: SearchOrigin | null;
  /** The filter scope: what actually narrows the clinic set. */
  scope: LocationScope;
  /** True when the origin came from parsing the typed location, not lat/lng. */
  originFromTypedLocation: boolean;
  /** Radius echoed back to the client (may differ from the applied one). */
  echoRadius: number;
}

/**
 * Read `lat`/`lng`/`location`/`radius` and decide the search scope.
 *
 * Mirrors the precedence the engine has always used:
 *  1. explicit `lat`/`lng` win as the origin;
 *  2. otherwise a typed zip / "City, ST" is geocoded in-memory;
 *  3. a location that did NOT geocode falls back to a state or text match;
 *  4. the radius hard-filter applies only with an origin AND either an explicit
 *     radius or a typed-location origin (50 miles by default).
 */
export function resolveLocationScope(searchParams: URLSearchParams): ResolvedLocation {
  const location = (searchParams.get("location") || "").trim();
  const latRaw = searchParams.get("lat");
  const lngRaw = searchParams.get("lng");
  const radiusRaw = searchParams.get("radius");

  const explicitRadius = radiusRaw !== null && Number.isFinite(Number(radiusRaw));
  // NOTE: the engine has always echoed 25 as the default radius while applying
  // 50. Kept as-is so the response contract does not change under callers.
  const echoRadius = explicitRadius ? Number(radiusRaw) : 25;

  let origin: SearchOrigin | null = null;
  if (latRaw !== null && lngRaw !== null && Number.isFinite(Number(latRaw)) && Number.isFinite(Number(lngRaw))) {
    origin = { lat: Number(latRaw), lng: Number(lngRaw) };
  }

  const typedGeo = location ? resolveTypedLocation(location) : null;
  const originFromTypedLocation = Boolean(typedGeo);
  if (!origin && typedGeo) origin = typedGeo;

  // Radius hard-filter — when the user explicitly picks a distance band, OR
  // when the origin came from a typed zip / "City, ST" (ecommerce behavior:
  // "37201" means near 37201, not the whole country — default 50 miles).
  if (origin && (explicitRadius || originFromTypedLocation)) {
    return {
      origin,
      originFromTypedLocation,
      echoRadius,
      scope: {
        kind: "origin",
        lat: origin.lat,
        lng: origin.lng,
        radiusMiles: explicitRadius ? Number(radiusRaw) : DEFAULT_ORIGIN_RADIUS_MILES,
      },
    };
  }

  // A location string that did not geocode — match it as a state, else as text.
  if (location && !originFromTypedLocation) {
    const upper = location.toUpperCase();
    const abbr = STATE_ABBR_TO_NAME[upper] ? upper : STATE_NAME_TO_ABBR[upper];
    const fullName = abbr ? STATE_ABBR_TO_NAME[abbr] : undefined;
    if (abbr && fullName) {
      return { origin, originFromTypedLocation, echoRadius, scope: { kind: "state", abbr, fullName } };
    }
    return { origin, originFromTypedLocation, echoRadius, scope: { kind: "text", term: location } };
  }

  return { origin, originFromTypedLocation, echoRadius, scope: { kind: "national" } };
}

/**
 * Haversine great-circle distance in MILES, as a SQL expression, from the
 * origin bound to `$latParam`/`$lngParam` to the columns named by `latCol` /
 * `lngCol`. 3959 = Earth radius in miles; GREATEST/LEAST clamp acos domain
 * errors from floating-point drift at zero distance.
 *
 * PostGIS is installed but unusable here — `spatial_ref_sys` is empty after the
 * Neon→RDS migration, so `ST_SetSRID(…, 4326)` throws "Cannot find SRID (4326)".
 * This expression is the only distance math in the app; keep it that way.
 */
export function haversineMilesSql(
  latParam: number,
  lngParam: number,
  latCol: string,
  lngCol: string,
): string {
  return `3959 * acos(GREATEST(-1, LEAST(1,
    cos(radians($${latParam})) * cos(radians(${latCol}))
    * cos(radians(${lngCol}) - radians($${lngParam}))
    + sin(radians($${latParam})) * sin(radians(${latCol}))
  )))`;
}
