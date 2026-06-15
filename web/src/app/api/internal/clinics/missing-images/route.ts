/**
 * GET /api/internal/clinics/missing-images
 * Returns clinics that have no OK cover image — for the image finder.
 */

export const dynamic = "force-dynamic";

import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { ourQuery } from "@/lib/sync/db-helpers";

interface ClinicRow {
  id: string;
  name: string;
  website: string;
  business_name: string;
}

export async function GET(req: Request): Promise<Response> {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  const clinics = await ourQuery<ClinicRow>(
    `SELECT c.id, c.name, c.website, b.name AS business_name
     FROM clinics c
     JOIN businesses b ON b.id = c.business_id
     WHERE c.is_active = true
       AND c.website IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM images i
         WHERE i.entity_type = 'clinic'
           AND i.entity_id = c.id
           AND i.role = 'cover'
           AND i.scrape_status = 'ok'
       )
     ORDER BY c.id`
  );

  return Response.json({ clinics });
}
