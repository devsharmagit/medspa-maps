import { NextRequest } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin/auth";
import { successResponse, handleApiError } from "@/lib/api-response";

const patchSchema = z
  .object({
    name: z.string().min(1).max(255),
    slug: z.string().min(1).max(255),
    is_active: z.boolean(),
  })
  .partial();

interface Concern {
  id: string;
  name: string;
  slug: string;
  origin: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CONCERN_COLUMNS = `id, name, slug, origin, is_active, created_at, updated_at`;

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function loadConcern(id: string): Promise<Concern | null> {
  return queryOne<Concern>(
    `SELECT ${CONCERN_COLUMNS} FROM concerns c WHERE c.id = $1`,
    [id]
  );
}

// GET /api/admin/concerns/[id]
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();

    const { id } = await params;
    const concern = await loadConcern(id);
    if (!concern) throw ApiError.notFound("Concern not found");

    return successResponse(concern);
  } catch (err) {
    return handleApiError(err);
  }
}

// PATCH /api/admin/concerns/[id] — update name/slug/is_active
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();

    const { id } = await params;
    const body = await req.json();
    const updates = patchSchema.parse(body);

    const keys = Object.keys(updates) as (keyof typeof updates)[];

    if (keys.length === 0) {
      throw ApiError.badRequest("No fields to update");
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];
    keys.forEach((key) => {
      values.push(updates[key]);
      setClauses.push(`${key} = $${values.length}`);
    });
    setClauses.push("updated_at = now()");
    values.push(id);

    const updated = await queryOne<{ id: string }>(
      `UPDATE concerns SET ${setClauses.join(", ")}
       WHERE id = $${values.length}
       RETURNING id`,
      values
    );
    if (!updated) throw ApiError.notFound("Concern not found");

    const concern = await loadConcern(id);
    return successResponse(concern);
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return handleApiError(ApiError.conflict("A concern with that slug already exists"));
    }
    return handleApiError(err);
  }
}

// DELETE /api/admin/concerns/[id] — permanent delete.
// clinic_concerns / clinic_service_concerns / provider_concerns links cascade
// away; reviews are nulled (ON DELETE SET NULL).
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();

    const { id } = await params;

    const rows = await query<{ id: string; name: string }>(
      `DELETE FROM concerns WHERE id = $1 RETURNING id, name`,
      [id]
    );

    if (rows.length === 0) throw ApiError.notFound("Concern not found");

    return successResponse({ id: rows[0].id, name: rows[0].name });
  } catch (err) {
    return handleApiError(err);
  }
}
