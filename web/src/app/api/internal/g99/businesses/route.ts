import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { queryG99 } from "@/lib/db";
import { successResponse, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  try {
    const rows = await queryG99(`
      SELECT
        b.id              AS business_id,
        b.name            AS business_name,
        b.g99_business_id,
        b.g99_tenant_id,
        json_agg(json_build_object(
          'clinic_id',          c.id,
          'clinic_name',        c.name,
          'clinic_address',     c.address,
          'clinic_city',        c.city,
          'clinic_state',       c.state,
          'clinic_country',     c.country,
          'clinic_phone',       c.phone,
          'clinic_email',       c.email,
          'clinic_website',     c.website,
          'clinic_about',       c.about,
          'google_my_business', c.google_my_business,
          'google_place_id',    c.google_place_id,
          'g99_clinic_id',      c.g99_clinic_id
        )) AS clinics
      FROM businesses b
      JOIN clinics c ON c.business_id = b.id
      WHERE b.is_active IS NOT FALSE
        AND c.is_active IS NOT FALSE
      GROUP BY b.id
    `);

    return successResponse(rows);
  } catch (err) {
    return handleApiError(err);
  }
}
