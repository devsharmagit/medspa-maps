import { NextRequest, NextResponse } from "next/server";
import { searchZipPrefix, searchCity } from "@/lib/location/postal-index";
import { toStateCode, toStateName } from "@/lib/location/states";

/**
 * GET /api/locations/suggest?q=<text>&country=US&limit=8
 *
 * Blinkit/Flipkart-style location typeahead. Served entirely from the
 * in-memory postal index (src/data/postal-codes-us.json — GeoNames dump);
 * no database round-trip, so every keystroke resolves in ~0ms.
 *
 * India later: add postal-codes-in.json to src/data, register it in
 * postal-index.ts, and pass country=IN.
 */

export interface LocationSuggestion {
  label: string; // "37203 — Nashville, TN", "Nashville, TN", or "Utah — Anywhere in the state"
  kind: "zip" | "city" | "state";
  postal_code: string | null;
  city: string;
  state_code: string | null;
  state_name: string | null;
  /** null for a "state" suggestion — a state search runs as a statewide text
   *  match (search API's STATE_ABBR_TO_NAME), not a radius from one point. */
  lat: number | null;
  lng: number | null;
}

const MAX_LIMIT = 15;

// Deliberately UNCACHED. The lookup is an in-memory index (~0ms), so caching
// buys no real performance — but it costs correctness: a visitor's own
// browser would keep replaying a pre-deploy response for an identical query
// (e.g. the "Mascoutah, IL" mis-match for "utah" before the ranking fix) with
// no way to invalidate it short of a hard refresh, even though the server has
// long since started returning the right answer. Never cache this endpoint.
const CACHE_HEADERS = {
  "Cache-Control": "no-store",
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = (searchParams.get("q") || "").trim();
  const country = (searchParams.get("country") || "US").toUpperCase();
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") || "8", 10) || 8, 1),
    MAX_LIMIT,
  );

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] }, { headers: CACHE_HEADERS });
  }

  const suggestions: LocationSuggestion[] = [];

  if (/^\d+$/.test(q)) {
    // ── Numeric input → zip prefix search ───────────────────────────────────
    for (const e of searchZipPrefix(q, limit, country)) {
      suggestions.push({
        label: `${e.postal_code} — ${e.city}, ${e.state_code}`,
        kind: "zip",
        postal_code: e.postal_code,
        city: e.city,
        state_code: e.state_code,
        state_name: e.state_name,
        lat: e.lat,
        lng: e.lng,
      });
    }
  } else {
    // A recognized US state ("Utah", "TX") gets its own suggestion, ALWAYS
    // first: picking it runs a statewide search (no lat/lng — the search API's
    // STATE_ABBR_TO_NAME text match), not a radius from some arbitrary point.
    const stateCode = country === "US" ? toStateCode(q) : null;
    if (stateCode) {
      suggestions.push({
        label: `${toStateName(stateCode)} — Anywhere in the state`,
        kind: "state",
        postal_code: null,
        city: toStateName(stateCode) ?? stateCode,
        state_code: stateCode,
        state_name: toStateName(stateCode),
        lat: null,
        lng: null,
      });
    }

    // ── Text input → city search (exact > prefix > substring, by size) ──────
    // When the query IS a state name, substring-only city hits are almost
    // always false positives (e.g. "utah" ⊂ "Mascoutah, IL") — drop them so
    // they don't crowd out or outrank the correct statewide option above.
    const cityLimit = stateCode ? Math.max(limit - suggestions.length, 0) : limit;
    for (const c of searchCity(q, cityLimit, country)) {
      if (stateCode && !c.city.toLowerCase().startsWith(q.toLowerCase())) continue;
      suggestions.push({
        label: `${c.city}, ${c.state_code}`,
        kind: "city",
        postal_code: null,
        city: c.city,
        state_code: c.state_code,
        state_name: c.state_name,
        lat: c.lat,
        lng: c.lng,
      });
    }
  }

  return NextResponse.json({ suggestions }, { headers: CACHE_HEADERS });
}
