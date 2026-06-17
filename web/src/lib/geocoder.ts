/**
 * geocoder.ts
 *
 * Free geocoding using OpenStreetMap Nominatim.
 * Terms of use: max 1 request per second, must include a descriptive User-Agent.
 * https://operations.osmfoundation.org/policies/nominatim/
 */

import { parseUSAddress, STATE_ABBREVIATIONS } from "./address-parser";

export interface GeoResult {
  lat: number;
  lng: number;
}

// ── Simple in-process rate limiter ──────────────────────────────────────────

let lastRequestTime = 0;
const MIN_INTERVAL_MS = 1_100; // slightly over 1 second to stay safe

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, MIN_INTERVAL_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

// ── Internal fetch helper ───────────────────────────────────────────────────

async function nominatimSearch(query: string): Promise<GeoResult | null> {
  await rateLimit();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "MedSpaMaps/1.0 (medspa-maps-geocoder)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  const lat = parseFloat(data[0].lat);
  const lng = parseFloat(data[0].lon);

  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Geocode a US address string to lat/lng via Nominatim.
 *
 * Strategy:
 *  1. Try the full address first (most precise)
 *  2. If no results, try a simplified "city, state zip" query
 *
 * Returns `null` on failure — never throws.
 */
export async function geocodeAddress(address: string): Promise<GeoResult | null> {
  if (!address || address.trim().length < 5) return null;

  try {
    // ── Attempt 1: full address ─────────────────────────────────────────
    const fullResult = await nominatimSearch(address.trim());
    if (fullResult) return fullResult;

    // ── Attempt 2: simplified "City, ST ZIP" ────────────────────────────
    const parsed = parseUSAddress(address);
    if (parsed?.state) {
      const parts: string[] = [];
      if (parsed.city) parts.push(parsed.city);
      parts.push(STATE_ABBREVIATIONS[parsed.state] ?? parsed.state);
      if (parsed.zip) parts.push(parsed.zip);
      const simplified = parts.join(", ");

      if (simplified !== address.trim()) {
        const simpleResult = await nominatimSearch(simplified);
        if (simpleResult) return simpleResult;
      }
    }

    console.warn(`[geocoder] No results for "${address}"`);
    return null;
  } catch (err) {
    console.warn(
      `[geocoder] Failed for "${address}":`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
