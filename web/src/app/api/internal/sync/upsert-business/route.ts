import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { query, queryOne } from "@/lib/db";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  let body: { g99Business: { business_id: number; business_name: string; logo_url: string | null; about: string | null } };
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { g99Business } = body;
  if (!g99Business?.business_id || !g99Business?.business_name) {
    return errorResponse("Missing required fields", 400);
  }

  try {
    const row = await queryOne<{ id: string }>(
      `INSERT INTO businesses (name, data_source, g99_business_id, last_synced_at, is_active)
       VALUES ($1, 'g99', $2, NOW(), true)
       ON CONFLICT (g99_business_id) DO UPDATE SET
         name           = EXCLUDED.name,
         last_synced_at = NOW(),
         is_active      = true,
         updated_at     = NOW()
       RETURNING id`,
      [g99Business.business_name, g99Business.business_id]
    );

    if (!row) throw new Error("Upsert returned no row");

    // Store logo in images table
    if (g99Business.logo_url) {
      await query(
        `INSERT INTO images (entity_type, entity_id, source_url, role, sort_order, scrape_status)
         VALUES ('business', $1, $2, 'logo', 0, 'pending')
         ON CONFLICT (entity_type, entity_id, source_url) DO NOTHING`,
        [row.id, g99Business.logo_url]
      );
    }

    return successResponse({ our_business_id: row.id });
  } catch (err) {
    return handleApiError(err);
  }
}
