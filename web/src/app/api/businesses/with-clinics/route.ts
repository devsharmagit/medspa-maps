import { queryG99 } from "@/lib/db";
import { successResponse, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = `
     SELECT
    b.id AS business_id,
    b.name AS business_name,
    NULL AS business_address,
    NULL AS business_website,
    NULL AS business_phone,
    NULL AS business_city,
    NULL AS business_state,
    NULL AS business_country,
    (
        SELECT source_url FROM images
        WHERE entity_type = 'business' AND entity_id = b.id
        AND role = 'logo' AND scrape_status = 'ok'
        ORDER BY sort_order LIMIT 1
    ) AS logo_url,
    NULL AS about,
    json_agg(
        json_build_object(
            'clinic_id', c.id,
            'clinic_name', c.name,
            'clinic_address', c.address,
            'clinic_city', c.city,
            'clinic_state', c.state,
            'clinic_country', c.country,
            'clinic_contact_number', c.phone,
            'clinic_website', c.website,
            'clinic_about', c.about,
            'google_my_business', c.google_my_business,
            'google_place_id', c.google_place_id,
            'google_profile_id', NULL
        )
    ) AS clinics
FROM businesses b
JOIN clinics c
    ON c.business_id = b.id
WHERE
    b.is_active = TRUE
    AND c.is_active = TRUE
    AND c.website IS NOT NULL
    AND TRIM(c.website) <> ''
GROUP BY b.id;
    `;

    const results = await queryG99(sql);

    return successResponse(results);
  } catch (error) {
    return handleApiError(error);
  }
}
