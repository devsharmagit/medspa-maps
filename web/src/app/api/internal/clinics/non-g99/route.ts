/**
 * GET /api/internal/clinics/non-g99
 * Returns active non-G99 clinics that have a website — for the nightly scraper.
 * Includes clinics that haven't been scraped in the last 7 days.
 */

export const dynamic = "force-dynamic";

import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { ourQuery } from "@/lib/sync/db-helpers";

interface ClinicRow {
  id: string;
  name: string;
  website: string;
  business_id: string;
  business_name: string;
  last_scraped_at: string | null;
}

export async function GET(req: Request): Promise<Response> {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  const clinics = await ourQuery<ClinicRow>(
    `SELECT c.id, c.name, c.website, c.business_id, b.name AS business_name, c.last_scraped_at
     FROM clinics c
     JOIN businesses b ON b.id = c.business_id
     WHERE c.data_source != 'g99'
       AND c.is_active = true
       AND c.website IS NOT NULL
       AND (
         c.last_scraped_at IS NULL
         OR c.last_scraped_at < NOW() - INTERVAL '7 days'
       )
     ORDER BY c.last_scraped_at ASC NULLS FIRST`
  );

  return Response.json({ clinics });
}
