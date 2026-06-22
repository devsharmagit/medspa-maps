import pool from "@/lib/db";
import { successResponse, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/** GET /api/concerns — list of published concerns for nav / index pages */
export async function GET() {
  try {
    const { rows } = await pool.query(
      `SELECT c.slug, c.name, c.overview,
         (SELECT count(*)::int FROM concern_services cs WHERE cs.concern_id = c.id) AS service_count,
         (SELECT source_url FROM images i
            WHERE i.entity_type = 'concern' AND i.entity_id = c.id
              AND i.role = 'before_after' AND i.scrape_status = 'ok'
            ORDER BY i.sort_order LIMIT 1) AS image
       FROM concerns c
       WHERE c.is_active = true AND c.is_published = true
       ORDER BY c.name`
    );
    return successResponse({ concerns: rows, count: rows.length });
  } catch (err) {
    return handleApiError(err);
  }
}
