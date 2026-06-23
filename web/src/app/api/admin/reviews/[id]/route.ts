import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { queryOne } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { successResponse, handleApiError } from "@/lib/api-response";

const patchSchema = z
  .object({
    rating: z.number().int().min(1).max(5).nullable(),
    body: z.string().min(1, "Review body cannot be empty"),
    reviewer_name: z.string().max(255).nullable(),
    source: z.string().max(50),
    source_url: z.url("Must be a valid URL").nullable(),
    is_approved: z.boolean(),
    is_active: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });

interface Review {
  id: string;
  clinic_id: string | null;
  rating: number | null;
  body: string | null;
  reviewer_name: string | null;
  source: string;
  source_url: string | null;
  is_approved: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

const RETURNING = `id, clinic_id, rating, body, reviewer_name, source, source_url,
                 is_approved, is_active, created_at, updated_at`;

// PATCH /api/admin/reviews/[id] — edit fields incl is_approved (approve/unapprove)
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

    const updated = await queryOne<Review>(
      `UPDATE reviews SET ${cols.join(", ")} WHERE id = $${i} RETURNING ${RETURNING}`,
      values
    );

    if (!updated) throw ApiError.notFound("Review not found");

    return successResponse(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/admin/reviews/[id] — soft delete (is_active = false).
// The clinic rating trigger recomputes avg_rating / review_count.
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();

    const { id } = await params;

    const deleted = await queryOne<Review>(
      `UPDATE reviews SET is_active = false WHERE id = $1 RETURNING ${RETURNING}`,
      [id]
    );

    if (!deleted) throw ApiError.notFound("Review not found");

    return successResponse(deleted);
  } catch (err) {
    return handleApiError(err);
  }
}
