import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { query, queryOne, withTransaction } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { successResponse, handleApiError } from "@/lib/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Manually set which catalog treatments (services) and conditions (concerns) a
// clinic offers, from the admin edit page chips — independent of what was scraped.
const schema = z.object({
  treatment_ids: z.array(z.string().uuid()).default([]),
  concern_ids: z.array(z.string().uuid()).default([]),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

// PUT /api/admin/clinics/[id]/catalog
export async function PUT(req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { id: clinicId } = await params;

    const clinic = await queryOne<{ id: string }>(`SELECT id FROM clinics WHERE id = $1`, [clinicId]);
    if (!clinic) throw ApiError.notFound("Clinic not found");

    const { treatment_ids, concern_ids } = schema.parse(await req.json());

    // Validate every id against the active catalog (also gives us service names
    // for the clinic_services.raw_name NOT NULL column).
    const svcRows = treatment_ids.length
      ? await query<{ id: string; name: string }>(
          `SELECT id, name FROM services WHERE id = ANY($1) AND is_active = true`,
          [treatment_ids]
        )
      : [];
    const svcNames = new Map(svcRows.map((s) => [s.id, s.name]));
    const validServiceIds = svcRows.map((s) => s.id);

    const conRows = concern_ids.length
      ? await query<{ id: string }>(
          `SELECT id FROM concerns WHERE id = ANY($1) AND is_active = true`,
          [concern_ids]
        )
      : [];
    const validConcernIds = conRows.map((c) => c.id);

    await withTransaction(async (tx) => {
      // ── Treatments (clinic_services) ──
      // Deactivate any active linked service not in the new selection.
      await tx.query(
        `UPDATE clinic_services SET is_active = false, updated_at = now()
          WHERE clinic_id = $1 AND is_active = true
            AND (service_id IS NULL OR service_id <> ALL($2::uuid[]))`,
        [clinicId, validServiceIds]
      );
      // Add / reactivate each selected service.
      for (const sid of validServiceIds) {
        const existing = await tx.query<{ id: string }>(
          `SELECT id FROM clinic_services WHERE clinic_id = $1 AND service_id = $2 LIMIT 1`,
          [clinicId, sid]
        );
        if (existing.rows[0]) {
          await tx.query(
            `UPDATE clinic_services SET is_active = true, match_status = 'matched', updated_at = now()
              WHERE id = $1`,
            [existing.rows[0].id]
          );
        } else {
          await tx.query(
            `INSERT INTO clinic_services (clinic_id, service_id, raw_name, match_status, is_active)
             VALUES ($1, $2, $3, 'matched', true)`,
            [clinicId, sid, svcNames.get(sid) ?? "Treatment"]
          );
        }
      }

      // ── Conditions (clinic_concerns) ──
      await tx.query(
        `UPDATE clinic_concerns SET is_active = false, updated_at = now()
          WHERE clinic_id = $1 AND is_active = true AND source <> 'removed'
            AND concern_id <> ALL($2::uuid[])`,
        [clinicId, validConcernIds]
      );
      for (const cid of validConcernIds) {
        await tx.query(
          `INSERT INTO clinic_concerns (clinic_id, concern_id, source, is_active)
           VALUES ($1, $2, 'manual', true)
           ON CONFLICT (clinic_id, concern_id)
             DO UPDATE SET is_active = true, updated_at = now(),
                           source = CASE WHEN clinic_concerns.source = 'removed' THEN 'manual' ELSE clinic_concerns.source END`,
          [clinicId, cid]
        );
      }
    });

    return successResponse({
      treatments: validServiceIds.length,
      concerns: validConcernIds.length,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
