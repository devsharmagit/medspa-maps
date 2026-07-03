/**
 * POST /api/internal/rescrape/refresh-view — refresh the public search view.
 *
 * clinic_search_view denormalizes each clinic's service_slugs[]; after a
 * re-scrape run changes treatments, the cron calls this once so public search
 * reflects the new offerings. Auth: X-Internal-Secret (INTERNAL_API_SECRET).
 */

import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { query } from "@/lib/db";
import { successResponse, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  try {
    await query("REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view");
    return successResponse({ refreshed: true });
  } catch (err) {
    return handleApiError(err);
  }
}
