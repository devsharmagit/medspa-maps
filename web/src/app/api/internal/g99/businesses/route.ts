import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { queryG99 } from "@/lib/db";
import { successResponse, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  try {
    const rows = await queryG99(`
      SELECT
        b.id          AS business_id,
        b.name        AS business_name,
        b.logo_url,
        b.about,
        json_agg(json_build_object(
          'clinic_id',            c.id,
          'clinic_name',          c.name,
          'clinic_address',       c.address,
          'clinic_city',          c.city,
          'clinic_state',         c.state,
          'clinic_country',       c.country,
          'clinic_contact_number',c.contact_number,
          'clinic_website',       c.website,
          'clinic_about',         c.about,
          'google_my_business',   c.google_my_business,
          'google_place_id',      c.google_place_id,
          'google_profile_id',    c.google_profile_id
        )) AS clinics
      FROM businesses b
      JOIN clinics c ON c.tenant_id = b.id
      WHERE b.deleted IS NOT TRUE
        AND c.deleted IS NOT TRUE
      GROUP BY b.id
    `);

    return successResponse(rows);
  } catch (err) {
    return handleApiError(err);
  }
}
