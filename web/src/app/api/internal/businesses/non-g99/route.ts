/**
 * GET /api/internal/businesses/non-g99
 * Returns active non-G99 businesses that have a website — for the scraper.
 */

export const dynamic = "force-dynamic";

import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { ourQuery } from "@/lib/sync/db-helpers";

interface NonG99Business {
  id: string;
  name: string;
  website_url: string;
}

export async function GET(req: Request): Promise<Response> {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  const businesses = await ourQuery<NonG99Business>(
    `SELECT id, name, website_url
     FROM businesses
     WHERE data_source != 'g99'
       AND is_active = true
       AND website_url IS NOT NULL
     ORDER BY id`
  );

  return Response.json({ businesses });
}
