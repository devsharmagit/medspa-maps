/**
 * GET /api/internal/rescrape/clinics — list clinics eligible for re-scrape.
 *
 * Called by the cron server to page through the medspa DB. Auth: the shared
 * X-Internal-Secret header (INTERNAL_API_SECRET).
 *
 * Query params: ?limit (1..1000, default 200) & ?offset (default 0).
 * Returns { total, count, clinics: [{ id, name, website, last_scraped_at }] }.
 */

import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { successResponse, handleApiError } from "@/lib/api-response";
import { listRescrapeClinics, countRescrapeClinics } from "@/lib/rescrape/list";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? "200");
    const offset = Number(url.searchParams.get("offset") ?? "0");

    const [total, clinics] = await Promise.all([
      countRescrapeClinics(),
      listRescrapeClinics({
        limit: Number.isFinite(limit) ? limit : 200,
        offset: Number.isFinite(offset) ? offset : 0,
      }),
    ]);

    return successResponse({ total, count: clinics.length, clinics });
  } catch (err) {
    return handleApiError(err);
  }
}
