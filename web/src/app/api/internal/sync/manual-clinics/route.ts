import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { query } from "@/lib/db";
import { successResponse, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  try {
    const rows = await query<{ id: string; business_id: string; website: string }>(
      `SELECT id, business_id, website
       FROM clinics
       WHERE data_source = 'manual'
         AND is_active = true
         AND website IS NOT NULL
         AND website <> ''
       ORDER BY last_scraped_at ASC NULLS FIRST`
    );

    return successResponse(rows);
  } catch (err) {
    return handleApiError(err);
  }
}
