import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { queryOne, withTransaction } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { successResponse, handleApiError } from "@/lib/api-response";

const patchSchema = z
  .object({
    name: z.string().min(1, "Business name is required").max(255),
    is_active: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });

interface Business {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

// DELETE /api/admin/businesses/[id]
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();

    const { id } = await params;

    // Clinics reference businesses with ON DELETE RESTRICT, so a business that
    // still owns clinics cannot be deleted. Surface a clear, actionable message
    // instead of leaking a raw FK-constraint 500.
    const { clinic_count } = (await queryOne<{ clinic_count: number }>(
      "SELECT count(*)::int AS clinic_count FROM clinics WHERE business_id = $1",
      [id]
    )) ?? { clinic_count: 0 };

    if (clinic_count > 0) {
      const noun = clinic_count === 1 ? "clinic" : "clinics";
      const pronoun = clinic_count === 1 ? "it" : "them";
      throw ApiError.conflict(
        `This business still has ${clinic_count} ${noun}. Delete or reassign ${pronoun} before deleting the business.`
      );
    }

    const deleted = await queryOne<Business>(
      "DELETE FROM businesses WHERE id = $1 RETURNING id, name",
      [id]
    );

    if (!deleted) throw ApiError.notFound("Business not found");

    return successResponse({ id: deleted.id, name: deleted.name });
  } catch (err) {
    return handleApiError(err);
  }
}

// PATCH /api/admin/businesses/[id] — edit business name and/or is_active
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();

    const { id } = await params;
    const body = await req.json();
    const fields = patchSchema.parse(body);

    const cols: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const [key, value] of Object.entries(fields)) {
      cols.push(`${key} = $${i++}`);
      values.push(value);
    }
    values.push(id);

    const updated = await withTransaction(async (client) => {
      const res = await client.query<Business>(
        `UPDATE businesses SET ${cols.join(", ")}
          WHERE id = $${i}
          RETURNING id, name, is_active, created_at`,
        values
      );
      const row = res.rows[0];
      if (!row) return null;

      // A business acts as the master switch for everything beneath it:
      // toggling is_active cascades the same value to its clinics and their
      // providers, so nothing stays publicly visible under a disabled business
      // (and re-enabling brings them back together).
      if (fields.is_active !== undefined) {
        await client.query(
          `UPDATE clinics SET is_active = $1, updated_at = NOW() WHERE business_id = $2`,
          [fields.is_active, id]
        );
        await client.query(
          `UPDATE providers SET is_active = $1, updated_at = NOW()
             WHERE clinic_id IN (SELECT id FROM clinics WHERE business_id = $2)`,
          [fields.is_active, id]
        );
      }
      return row;
    });

    if (!updated) throw ApiError.notFound("Business not found");

    return successResponse(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
