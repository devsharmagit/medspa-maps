import { requireAdmin } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { successResponse, handleApiError } from "@/lib/api-response";

interface ProviderListItem {
  id: string;
  clinic_id: string;
  name: string;
  title: string | null;
  image_url: string | null;
  is_verified: boolean;
  card_tagline: string | null;
  is_active: boolean;
  created_at: string;
  clinic_name: string;
}

// GET /api/admin/providers — list all providers across all clinics
export async function GET() {
  try {
    await requireAdmin();

    const providers = await query<ProviderListItem>(
      `SELECT p.id, p.clinic_id, p.name, p.title, p.image_url, p.is_verified,
              p.card_tagline, p.is_active, p.created_at, c.name AS clinic_name
         FROM providers p
         JOIN clinics c ON c.id = p.clinic_id
        ORDER BY c.name ASC, p.name ASC`
    );

    return successResponse(providers);
  } catch (err) {
    return handleApiError(err);
  }
}
