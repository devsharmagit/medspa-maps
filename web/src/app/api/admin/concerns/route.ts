import { NextRequest } from "next/server";
import { z } from "zod";
import { query, queryOne } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin/auth";
import { successResponse, handleApiError } from "@/lib/api-response";

const createConcernSchema = z.object({
  name: z.string().min(1, "Concern name is required").max(255),
  slug: z.string().min(1).max(255).optional(),
  overview: z.string().nullish(),
  details: z.record(z.string(), z.unknown()).nullish(),
  faqs: z.array(z.unknown()).nullish(),
  aliases: z.array(z.string()).optional(),
  is_published: z.boolean().optional(),
  service_ids: z.array(z.string().uuid()).optional(),
});

interface Concern {
  id: string;
  name: string;
  slug: string;
  overview: string | null;
  details: Record<string, unknown> | null;
  faqs: unknown[] | null;
  aliases: string[] | null;
  is_published: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// GET /api/admin/concerns — list all (incl is_active=false) with service link count
export async function GET() {
  try {
    await requireAdmin();

    const concerns = await query<Concern & { service_count: number }>(
      `SELECT c.id, c.name, c.slug, c.overview, c.details, c.faqs, c.aliases,
              c.is_published, c.is_active, c.created_at, c.updated_at,
              (SELECT count(*)::int FROM concern_services cs WHERE cs.concern_id = c.id) AS service_count
       FROM concerns c
       ORDER BY c.name`
    );

    return successResponse(concerns);
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/admin/concerns — create (+ optional concern_services links)
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json();
    const input = createConcernSchema.parse(body);

    const created = await queryOne<Concern>(
      `INSERT INTO concerns (name, slug, overview, details, faqs, aliases, is_published)
       VALUES ($1, COALESCE($2, slugify($1)), $3, $4::jsonb, $5::jsonb, COALESCE($6, '{}'::text[]), COALESCE($7, false))
       RETURNING id, name, slug, overview, details, faqs, aliases,
                 is_published, is_active, created_at, updated_at`,
      [
        input.name,
        input.slug ?? null,
        input.overview ?? null,
        input.details ? JSON.stringify(input.details) : null,
        input.faqs ? JSON.stringify(input.faqs) : null,
        input.aliases ?? null,
        input.is_published ?? null,
      ]
    );

    if (!created) throw ApiError.internal("Failed to create concern");

    if (input.service_ids && input.service_ids.length > 0) {
      await query(
        `INSERT INTO concern_services (concern_id, service_id, display_order)
         SELECT $1, sid, ord - 1
         FROM unnest($2::uuid[]) WITH ORDINALITY AS t(sid, ord)
         ON CONFLICT DO NOTHING`,
        [created.id, input.service_ids]
      );
    }

    return successResponse(created, 201);
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return handleApiError(ApiError.conflict("A concern with that slug already exists"));
    }
    return handleApiError(err);
  }
}
