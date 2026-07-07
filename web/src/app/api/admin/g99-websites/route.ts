import { requireAdmin } from "@/lib/admin/auth";
import { successResponse, handleApiError } from "@/lib/api-response";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// One row per unique medspa website (table public.g99_clinic_websites).
// bigint[] columns come back as string[].
export interface G99WebsiteRow {
  domain: string;
  website: string;
  clinic_count: number;
  business_count: number;
  g99_clinic_ids: string[];
  g99_business_ids: string[];
  business_name: string | null;
  clinic_name: string | null;
  specialization: string | null;
}

// GET /api/admin/g99-websites — the unique medspa websites harvested from G99.
export async function GET() {
  try {
    await requireAdmin();

    const rows = await query<G99WebsiteRow>(
      `SELECT domain,
              website,
              clinic_count,
              business_count,
              g99_clinic_ids,
              g99_business_ids,
              business_name,
              clinic_name,
              specialization
         FROM g99_clinic_websites
        ORDER BY clinic_count DESC, domain ASC`
    );

    return successResponse(rows);
  } catch (err) {
    return handleApiError(err);
  }
}
