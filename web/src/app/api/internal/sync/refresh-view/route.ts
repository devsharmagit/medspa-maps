import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { query } from "@/lib/db";
import { successResponse, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  try {
    await query("REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view");
    return successResponse({ refreshed: true });
  } catch (err) {
    return handleApiError(err);
  }
}
