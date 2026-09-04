import { NextRequest } from "next/server";
import { successResponse, handleApiError } from "@/lib/api-response";
import { getSearchOptionCounts, type SearchOptionCounts } from "@/lib/search/option-counts";

export const dynamic = "force-dynamic";

/**
 * GET /api/search-options?lat&lng&location&radius
 *
 * Options for the "Treatment or Condition" dropdown (hero, Find-the-Perfect-
 * Clinic, /search), each with the number of clinics that actually offer it in
 * the caller's location — nationwide when no location is set.
 *
 * Both catalogs come back in ONE response on purpose: fetching them separately
 * lets treatments and concerns settle on different locations mid-typing.
 */

// Counts move only when the catalog or a clinic's location changes, so a short
// in-process TTL cache is enough. The key rounds coordinates to ~7 miles, which
// collapses the location typeahead's per-keystroke coordinate churn to a handful
// of entries without changing any count a user would notice.
const TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 64;
const cache = new Map<string, { at: number; payload: SearchOptionCounts }>();

function cacheKey(params: URLSearchParams): string {
  const round = (v: string | null) => (v && Number.isFinite(Number(v)) ? Number(v).toFixed(1) : "");
  return [
    round(params.get("lat")),
    round(params.get("lng")),
    params.get("radius") ?? "",
    (params.get("location") ?? "").trim().toLowerCase(),
  ].join("|");
}

export async function GET(req: NextRequest) {
  try {
    const key = cacheKey(req.nextUrl.searchParams);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) {
      return successResponse(hit.payload);
    }

    const payload = await getSearchOptionCounts(req.nextUrl.searchParams);

    if (cache.size >= MAX_ENTRIES) {
      // Cheap eviction: drop the oldest insertion (Map preserves insert order).
      const oldest = cache.keys().next();
      if (!oldest.done) cache.delete(oldest.value);
    }
    cache.set(key, { at: Date.now(), payload });

    return successResponse(payload);
  } catch (err) {
    return handleApiError(err);
  }
}
