import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { successResponse, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/**
 * GET /api/concerns — list of active concerns for nav / index pages.
 *
 * GET /api/concerns?scope=search — options for the search "Condition" dropdown:
 * ALL active concerns (AI-grown ones included) that at least one clinic actually
 * treats (active scraped/manual membership), so the dropdown never offers a
 * zero-result option. Returns `{slug, name}` only.
 */
export async function GET(req: NextRequest) {
  try {
    if (req.nextUrl.searchParams.get("scope") === "search") {
      const { rows } = await pool.query(
        `SELECT c.slug, c.name
           FROM concerns c
          WHERE c.is_active = true
            AND EXISTS (
              SELECT 1 FROM clinic_concerns cc
              WHERE cc.concern_id = c.id AND cc.is_active = true
                AND cc.source IN ('scraped', 'manual')
            )
          ORDER BY c.name`
      );
      return successResponse({ concerns: rows, count: rows.length });
    }

    const { rows } = await pool.query(
      `SELECT c.slug, c.name
       FROM concerns c
       WHERE c.is_active = true
       ORDER BY c.name`
    );
    return successResponse({ concerns: rows, count: rows.length });
  } catch (err) {
    return handleApiError(err);
  }
}
