import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { queryOne } from "@/lib/db";
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

    const updated = await queryOne<Business>(
      `UPDATE businesses SET ${cols.join(", ")}
        WHERE id = $${i}
        RETURNING id, name, is_active, created_at`,
      values
    );

    if (!updated) throw ApiError.notFound("Business not found");

    return successResponse(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
