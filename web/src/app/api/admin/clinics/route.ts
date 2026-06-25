import { requireAdmin } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { successResponse, handleApiError } from "@/lib/api-response";

interface ClinicListItem {
  id: string;
  name: string;
  slug: string;
  business_id: string;
  business_name: string;
  city: string | null;
  state: string | null;
  review_count: number;
  is_active: boolean;
  created_at: string;
  location_count: number;
  location_cities: string | null;
}

// GET /api/admin/clinics — list clinics with business name, location count, review_count
export async function GET() {
  try {
    await requireAdmin();

    const clinics = await query<ClinicListItem>(
      `SELECT c.id, c.name, c.slug, c.business_id, b.name AS business_name,
              c.city, c.state, c.review_count, c.is_active, c.created_at,
              COUNT(cl.id)::int AS location_count,
              STRING_AGG(cl.city, ', ' ORDER BY cl.sort_order) AS location_cities
         FROM clinics c
         JOIN businesses b ON b.id = c.business_id
         LEFT JOIN clinic_locations cl ON cl.clinic_id = c.id AND cl.is_active = true
        GROUP BY c.id, b.name
        ORDER BY c.created_at DESC`
    );

    return successResponse(clinics);
  } catch (err) {
    return handleApiError(err);
  }
}
