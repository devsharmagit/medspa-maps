import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import { REVISION_COLUMNS, type RevisionRequest } from "../route";

const updateSchema = z
  .object({
    status: z.enum(["new", "reviewing", "resolved", "rejected"]).optional(),
    notes: z.string().max(5000).nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.notes !== undefined, {
    message: "Provide a status and/or notes to update.",
  });

// PATCH /api/admin/revision-requests/[id] — update status and/or internal notes.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const body = await req.json();
    const data = updateSchema.parse(body);

    const sets: string[] = [];
    const values: unknown[] = [];
    if (data.status !== undefined) {
      values.push(data.status);
      sets.push(`status = $${values.length}`);
    }
    if (data.notes !== undefined) {
      values.push(data.notes);
      sets.push(`notes = $${values.length}`);
    }
    values.push(id);

    // updated_at is maintained by the set_updated_at() trigger on UPDATE.
    const rows = await query<RevisionRequest>(
      `WITH upd AS (
         UPDATE clinic_revision_requests
            SET ${sets.join(", ")}
          WHERE id = $${values.length}
          RETURNING id, clinic_id, requester_name, requester_email, message, status, notes, created_at, updated_at
       )
       SELECT ${REVISION_COLUMNS}
         FROM upd r
         JOIN clinics c ON c.id = r.clinic_id`,
      values
    );

    if (rows.length === 0) return errorResponse("Revision request not found", 404);
    return successResponse(rows[0]);
  } catch (err) {
    return handleApiError(err);
  }
}
