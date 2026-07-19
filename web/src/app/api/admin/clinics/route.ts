import { requireAdmin } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { successResponse, handleApiError } from "@/lib/api-response";

interface ClinicListItem {
  id: string;
  name: string;
  slug: string;
  review_count: number;
  is_active: boolean;
  featured: boolean;
  created_at: string;
  location_count: number;
  location_cities: string | null;
  g99_clinic_id: string | null;
}

// GET /api/admin/clinics — list clinics with location count, review_count
export async function GET() {
  try {
    await requireAdmin();

    const clinics = await query<ClinicListItem>(
      `SELECT c.id, c.name, c.slug,
              c.review_count, c.is_active, c.featured, c.created_at,
              c.g99_clinic_id,
              COUNT(cl.id)::int AS location_count,
              STRING_AGG(cl.city, ', ' ORDER BY cl.sort_order) AS location_cities
         FROM clinics c
         LEFT JOIN clinic_locations cl ON cl.clinic_id = c.id AND cl.is_active = true
        GROUP BY c.id
        ORDER BY c.created_at DESC`
    );

    return successResponse(clinics);
  } catch (err) {
    return handleApiError(err);
  }
}
