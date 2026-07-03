/**
 * GET /api/admin/treatment-changes — the treatment change log for the admin UI.
 *
 * One row per canonical treatment a clinic started ('added') or stopped
 * ('removed') offering, as detected by the daily re-scrape cron.
 *
 * Query params (all optional):
 *   ?clinicId=<uuid>       — only this clinic's changes
 *   ?type=added|removed    — only this change type
 *   ?limit=<n>             — cap rows (default 200, max 1000)
 */

import { requireAdmin } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { successResponse, handleApiError } from "@/lib/api-response";

interface TreatmentChangeRow {
  id: string;
  clinic_id: string;
  clinic_name: string;
  clinic_slug: string;
  service_id: string | null;
  service_slug: string;
  service_name: string;
  change_type: "added" | "removed";
  raw_name: string | null;
  match_confidence: string | null;
  detected_at: string;
}

export async function GET(req: Request) {
  try {
    await requireAdmin();

    const url = new URL(req.url);
    const clinicId = url.searchParams.get("clinicId");
    const type = url.searchParams.get("type");
    const limitRaw = Number(url.searchParams.get("limit") ?? "200");
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 200, 1), 1000);

    const conds: string[] = [];
    const params: unknown[] = [];
    if (clinicId) {
      params.push(clinicId);
      conds.push(`csc.clinic_id = $${params.length}`);
    }
    if (type === "added" || type === "removed") {
      params.push(type);
      conds.push(`csc.change_type = $${params.length}`);
    }
    const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
    params.push(limit);

    const rows = await query<TreatmentChangeRow>(
      `SELECT csc.id, csc.clinic_id, c.name AS clinic_name, c.slug AS clinic_slug,
              csc.service_id, csc.service_slug, csc.service_name, csc.change_type,
              csc.raw_name, csc.match_confidence::text AS match_confidence,
              csc.detected_at
         FROM clinic_service_changes csc
         JOIN clinics c ON c.id = csc.clinic_id
         ${where}
        ORDER BY csc.detected_at DESC
        LIMIT $${params.length}`,
      params
    );

    return successResponse(rows);
  } catch (err) {
    return handleApiError(err);
  }
}
