/**
 * GET /api/internal/businesses/non-g99
 *
 * NOTE: Businesses no longer have website_url in the new schema.
 * Scraping is now done at the clinic level.
 * This endpoint is kept for backwards compatibility but returns an empty list.
 *
 * Use GET /api/internal/clinics/non-g99 instead.
 */

export const dynamic = "force-dynamic";

import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";

export async function GET(req: Request): Promise<Response> {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();
  return Response.json({ businesses: [], deprecated: true, use: "/api/internal/clinics/non-g99" });
}
