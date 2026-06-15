/**
 * POST /api/internal/sync/refresh-view
 * Refreshes the clinic_search_view materialized view after sync is complete.
 */

export const dynamic = "force-dynamic";

import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { ourQuery } from "@/lib/sync/db-helpers";

export async function POST(req: Request): Promise<Response> {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  try {
    await ourQuery("REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "clinic_search_view not found — skipping" });
  }
}
