/**
 * GET /api/internal/g99/businesses
 * Returns the list of valid G99 business IDs + names for the cron server to iterate.
 * Filters: not deleted, not test accounts (business_config.is_test_business = false)
 */

export const dynamic = "force-dynamic";

import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { g99Query } from "@/lib/sync/db-helpers";

export async function GET(req: Request): Promise<Response> {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  const businesses = await g99Query<{ id: string; name: string }>(
    `SELECT b.id::text AS id, b.name
     FROM businesses b
     JOIN business_config bc ON bc.tenant_id = b.id
     WHERE b.deleted = false
       AND bc.is_test_business = false
     ORDER BY b.id`
  );

  return Response.json({ businesses });
}
