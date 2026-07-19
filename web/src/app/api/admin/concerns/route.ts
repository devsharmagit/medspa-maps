import { NextRequest } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin/auth";
import { successResponse, handleApiError } from "@/lib/api-response";

const createConcernSchema = z.object({
  name: z.string().min(1, "Concern name is required").max(255),
  slug: z.string().min(1).max(255).optional(),
  is_active: z.boolean().optional(),
});

interface Concern {
  id: string;
  name: string;
  slug: string;
  origin: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// GET /api/admin/concerns — list all (incl is_active=false)
export async function GET() {
  try {
    await requireAdmin();

    const concerns = await query<Concern>(
      `SELECT c.id, c.name, c.slug, c.origin, c.is_active, c.created_at, c.updated_at
       FROM concerns c
       ORDER BY c.name`
    );

    return successResponse(concerns);
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/admin/concerns — create
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const input = createConcernSchema.parse(body);

    const created = await queryOne<Concern>(
      `INSERT INTO concerns (name, slug, is_active)
       VALUES ($1, COALESCE($2, slugify($1)), COALESCE($3, true))
       RETURNING id, name, slug, origin, is_active, created_at, updated_at`,
      [input.name, input.slug ?? null, input.is_active ?? null]
    );

    if (!created) throw ApiError.internal("Failed to create concern");

    return successResponse(created, 201);
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return handleApiError(ApiError.conflict("A concern with that slug already exists"));
    }
    return handleApiError(err);
  }
}
