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
}

// GET /api/admin/clinics — list clinics with business name, city, state, review_count
export async function GET() {
  try {
    await requireAdmin();

    const clinics = await query<ClinicListItem>(
      `SELECT c.id, c.name, c.slug, c.business_id, b.name AS business_name,
              c.city, c.state, c.review_count, c.is_active, c.created_at
         FROM clinics c
         JOIN businesses b ON b.id = c.business_id
        ORDER BY c.created_at DESC`
    );

    return successResponse(clinics);
  } catch (err) {
    return handleApiError(err);
  }
}
