import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { mapUnmatched } from "@/lib/admin/queue";
import { query } from "@/lib/db";
import { successResponse, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

const mapSchema = z.object({
  rawName: z.string().min(1, "rawName is required"),
  serviceId: z.string().min(1, "serviceId is required"),
  addAlias: z.boolean().optional(),
});

// POST /api/admin/unmatched/map — map a raw name onto an existing canonical service
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { rawName, serviceId, addAlias } = mapSchema.parse(body);

    const result = await mapUnmatched(rawName, serviceId, { addAlias });

    // Best-effort refresh of the public search view; don't fail the request if it errors.
    try {
      await query("REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view");
    } catch (refreshErr) {
      console.error("[unmatched/map] clinic_search_view refresh failed", refreshErr);
    }

    return successResponse({ updated: result.rows_updated, ...result });
  } catch (err) {
    return handleApiError(err);
  }
}
