/**
 * postal-index.ts — in-memory US postal-code index (no DB round-trip).
 *
 * Source: src/data/postal-codes-us.json (GeoNames dump, ~1.7 MB, 41,490 zips,
 * compact rows: [zip, city, stateCode, lat, lng]). Regenerate via
 * scripts/import-postal-codes.mjs docs. Loaded once per server process and
 * indexed for O(log n) zip-prefix scans and O(1) city lookups — every
 * keystroke of the typeahead is served from RAM.
 *
 * India later: add postal-codes-in.json (same GeoNames format) and register it
 * in COUNTRY_DATA below.
 */

import US_DATA from "@/data/postal-codes-us.json";
import { STATE_CODE_TO_NAME } from "./states";

type Row = [zip: string, city: string, stateCode: string, lat: number, lng: number];

export interface PostalEntry {
  postal_code: string;
  city: string;
  state_code: string;
  state_name: string | null;
  lat: number;
  lng: number;
}

export interface CityEntry {
  city: string;
  state_code: string;
  state_name: string | null;
  /** centroid across the city's zips */
  lat: number;
  lng: number;
  zip_count: number;
}

interface CountryIndex {
  /** rows sorted by postal_code — binary search for prefix ranges */
  byZip: PostalEntry[];
  /** exact zip → entry (first row wins) */
  zipMap: Map<string, PostalEntry>;
  /** lowercase "city|ST" → centroid entry */
  cityMap: Map<string, CityEntry>;
  /** unique city entries sorted by name for prefix scans */
  cities: CityEntry[];
}

const COUNTRY_DATA: Record<string, Row[]> = {
  US: US_DATA as Row[],
};

const indexes = new Map<string, CountryIndex>();

function buildIndex(country: string): CountryIndex | null {
  const data = COUNTRY_DATA[country];
  if (!data) return null;

  const byZip: PostalEntry[] = data
    .map(([postal_code, city, state_code, lat, lng]) => ({
      postal_code,
      city,
      state_code,
      state_name: STATE_CODE_TO_NAME[state_code] ?? null,
      lat,
      lng,
    }))
    .sort((a, b) => (a.postal_code < b.postal_code ? -1 : a.postal_code > b.postal_code ? 1 : 0));

  const zipMap = new Map<string, PostalEntry>();
  const cityAgg = new Map<string, { lat: number; lng: number; n: number; e: PostalEntry }>();
  for (const e of byZip) {
    if (!zipMap.has(e.postal_code)) zipMap.set(e.postal_code, e);
    const key = `${e.city.toLowerCase()}|${e.state_code}`;
    const agg = cityAgg.get(key);
    if (agg) {
      agg.lat += e.lat;
      agg.lng += e.lng;
      agg.n++;
    } else {
      cityAgg.set(key, { lat: e.lat, lng: e.lng, n: 1, e });
    }
  }

  const cityMap = new Map<string, CityEntry>();
  for (const [key, { lat, lng, n, e }] of cityAgg) {
    cityMap.set(key, {
      city: e.city,
      state_code: e.state_code,
      state_name: e.state_name,
      lat: Math.round((lat / n) * 10000) / 10000,
      lng: Math.round((lng / n) * 10000) / 10000,
      zip_count: n,
    });
  }
  const cities = [...cityMap.values()].sort((a, b) => a.city.localeCompare(b.city));

  return { byZip, zipMap, cityMap, cities };
}

function getIndex(country = "US"): CountryIndex | null {
  let idx = indexes.get(country);
  if (!idx) {
    const built = buildIndex(country);
    if (!built) return null;
    indexes.set(country, built);
    idx = built;
  }
  return idx;
}

/** Binary search: first index whose postal_code >= prefix */
function lowerBound(rows: PostalEntry[], prefix: string): number {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].postal_code < prefix) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Zips starting with `prefix`, ordered. */
export function searchZipPrefix(prefix: string, limit: number, country = "US"): PostalEntry[] {
  const idx = getIndex(country);
  if (!idx) return [];
  const out: PostalEntry[] = [];
  for (let i = lowerBound(idx.byZip, prefix); i < idx.byZip.length && out.length < limit; i++) {
    const e = idx.byZip[i];
    if (!e.postal_code.startsWith(prefix)) break;
    out.push(e);
  }
  return out;
}

/** Exact zip lookup. */
export function lookupZip(zip: string, country = "US"): PostalEntry | null {
  return getIndex(country)?.zipMap.get(zip) ?? null;
}

/** Cities matching `q`: exact name first, then prefix, then substring. */
export function searchCity(q: string, limit: number, country = "US"): CityEntry[] {
  const idx = getIndex(country);
  if (!idx) return [];
  const needle = q.toLowerCase();
  const exact: CityEntry[] = [];
  const prefix: CityEntry[] = [];
  const substr: CityEntry[] = [];
  for (const c of idx.cities) {
    const name = c.city.toLowerCase();
    if (name === needle) exact.push(c);
    else if (name.startsWith(needle)) prefix.push(c);
    else if (needle.length >= 4 && name.includes(needle)) substr.push(c);
    // keep scanning; lists are small enough (~29k unique cities) and we want
    // stable rank buckets — bail once the cheap buckets are already full
    if (exact.length + prefix.length >= limit && needle.length < 4) break;
  }
  const byPopularity = (a: CityEntry, b: CityEntry) => b.zip_count - a.zip_count;
  return [...exact.sort(byPopularity), ...prefix.sort(byPopularity), ...substr.sort(byPopularity)].slice(0, limit);
}

/** Exact "City, ST" or "City, StateName" lookup → centroid. */
export function lookupCityState(city: string, st: string, country = "US"): CityEntry | null {
  const idx = getIndex(country);
  if (!idx) return null;
  const stUpper = st.trim().toUpperCase();
  // resolve full state name → code if needed
  let code = stUpper.length === 2 ? stUpper : null;
  if (!code) {
    for (const [c, name] of Object.entries(STATE_CODE_TO_NAME)) {
      if (name.toUpperCase() === stUpper) {
        code = c;
        break;
      }
    }
  }
  if (!code) return null;
  return idx.cityMap.get(`${city.trim().toLowerCase()}|${code}`) ?? null;
}
