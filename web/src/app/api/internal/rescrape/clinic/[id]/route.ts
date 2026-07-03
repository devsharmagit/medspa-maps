/**
 * POST /api/internal/rescrape/clinic/[id] — re-scrape ONE clinic, reconcile its
 * treatments against a fresh scrape, and log every canonical add/remove.
 *
 * The scrape + diff + apply + log all happen server-side in one transaction
 * (see lib/rescrape/rescrape-clinic.ts). Called once per clinic by the cron
 * server. Auth: the shared X-Internal-Secret header (INTERNAL_API_SECRET).
 *
 * Returns the per-clinic summary { clinicId, added[], removed[], ok, error, ... }.
 */

import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { successResponse, handleApiError } from "@/lib/api-response";
import { rescrapeClinic } from "@/lib/rescrape/rescrape-clinic";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Scraping a site (homepage + sub-pages) can take a while; allow headroom on
// platforms that enforce a serverless duration cap.
export const maxDuration = 300;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteContext) {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  try {
    const { id } = await params;
    const result = await rescrapeClinic(id);
    return successResponse(result);
  } catch (err) {
    return handleApiError(err);
  }
}
