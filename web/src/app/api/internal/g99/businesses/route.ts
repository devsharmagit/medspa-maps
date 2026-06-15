/**
 * GET /api/internal/g99/businesses
 * Returns the list of valid G99 business IDs + names for the cron server to iterate.
 * Filters: not deleted, not test accounts, website must be a valid URL
 */

export const dynamic = "force-dynamic";

import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { g99Query } from "@/lib/sync/db-helpers";

function isValidUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export async function GET(req: Request): Promise<Response> {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  const rows = await g99Query<{ id: string; name: string; website: string | null }>(
    `SELECT b.id::text AS id, b.name, b.website
     FROM businesses b
     JOIN business_config bc ON bc.tenant_id = b.id
     WHERE b.deleted = false
       AND bc.is_test_business = false
     ORDER BY b.id`
  );

  const businesses = rows
    // .filter(({ website }) => isValidUrl(website))
    .map(({ id, name, website }) => ({ id, name, website: website as string }));

  return Response.json({ businesses });
}
