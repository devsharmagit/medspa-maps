import { NextRequest } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin/auth";
import { successResponse, handleApiError } from "@/lib/api-response";

const createServiceSchema = z.object({
  name: z.string().min(1, "Service name is required").max(255),
  slug: z.string().min(1).max(255).optional(),
  is_active: z.boolean().optional(),
});

interface Service {
  id: string;
  name: string;
  slug: string;
  origin: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// GET /api/admin/services — all services (incl is_active=false) with clinic usage count
export async function GET() {
  try {
    await requireAdmin();

    const services = await query<Service & { clinic_count: number }>(
      `SELECT s.id, s.name, s.slug, s.origin, s.is_active, s.created_at, s.updated_at,
              (SELECT count(DISTINCT cls.clinic_id)::int
                 FROM clinic_services cls
                 WHERE cls.service_id = s.id AND cls.is_active = true) AS clinic_count
       FROM services s
       ORDER BY s.name`
    );

    return successResponse(services);
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/admin/services — create
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const input = createServiceSchema.parse(body);

    const rows = await query<Service>(
      `INSERT INTO services (name, slug, origin, is_active)
       VALUES ($1, COALESCE($2, slugify($1)), 'manual', COALESCE($3, true))
       RETURNING id, name, slug, origin, is_active, created_at, updated_at`,
      [input.name, input.slug ?? null, input.is_active ?? null]
    );

    return successResponse(rows[0], 201);
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return handleApiError(ApiError.conflict("A service with that slug already exists"));
    }
    return handleApiError(err);
  }
}
