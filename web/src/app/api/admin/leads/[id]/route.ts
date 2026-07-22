import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";
import type { PatientLead } from "../route";

const LEAD_COLUMNS = `id, first_name, last_name, email, phone, source,
  treatment, concern, location, skin_navigator, status, notes,
  created_at, updated_at`;

const updateLeadSchema = z
  .object({
    status: z
      .enum(["new", "contacted", "qualified", "converted", "rejected"])
      .optional(),
    notes: z.string().max(5000).nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.notes !== undefined, {
    message: "Provide a status and/or notes to update.",
  });

// PATCH /api/admin/leads/[id] — update a lead's processing status and/or notes
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const body = await req.json();
    const data = updateLeadSchema.parse(body);

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
    sets.push("updated_at = NOW()");
    values.push(id);

    const rows = await query<PatientLead>(
      `UPDATE patient_leads
          SET ${sets.join(", ")}
        WHERE id = $${values.length}
        RETURNING ${LEAD_COLUMNS}`,
      values
    );

    if (rows.length === 0) return errorResponse("Lead not found", 404);
    return successResponse(rows[0]);
  } catch (err) {
    return handleApiError(err);
  }
}
