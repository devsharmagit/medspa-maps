import { NextRequest, NextResponse } from "next/server";
import { searchZipPrefix, searchCity } from "@/lib/location/postal-index";

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
  label: string; // "37203 — Nashville, TN"  or  "Nashville, TN"
  kind: "zip" | "city";
  postal_code: string | null;
  city: string;
  state_code: string | null;
  state_name: string | null;
  lat: number;
  lng: number;
}

const MAX_LIMIT = 15;

// Suggestions are static reference data — cache aggressively client/CDN-side.
const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
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
    // ── Text input → city search (exact > prefix > substring, by size) ──────
    for (const c of searchCity(q, limit, country)) {
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
