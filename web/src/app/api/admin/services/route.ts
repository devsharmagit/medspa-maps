import { NextRequest } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin/auth";
import { successResponse, handleApiError } from "@/lib/api-response";

const createServiceSchema = z.object({
  name: z.string().min(1, "Service name is required").max(255),
  slug: z.string().min(1).max(255).optional(),
  category: z.string().max(255).nullish(),
  aliases: z.array(z.string()).optional(),
  summary: z.string().nullish(),
  description: z.string().nullish(),
  treatment_time: z.string().max(255).nullish(),
  results_timeline: z.string().max(255).nullish(),
  results_duration: z.string().max(255).nullish(),
  recovery_time: z.string().max(255).nullish(),
  faqs: z.array(z.unknown()).nullish(),
  review_status: z.string().max(50).nullish(),
});

interface Service {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  aliases: string[] | null;
  summary: string | null;
  description: string | null;
  treatment_time: string | null;
  results_timeline: string | null;
  results_duration: string | null;
  recovery_time: string | null;
  review_status: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// GET /api/admin/services — all services (incl is_active=false) with clinic usage count
export async function GET() {
  try {
    await requireAdmin();

    const services = await query<Service & { clinic_count: number }>(
      `SELECT s.id, s.name, s.slug, s.category, s.aliases, s.summary, s.description,
              s.treatment_time, s.results_timeline, s.results_duration, s.recovery_time,
              s.review_status, s.is_active, s.created_at, s.updated_at,
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
      `INSERT INTO services
         (name, slug, category, aliases, summary, description,
          treatment_time, results_timeline, results_duration, recovery_time,
          faqs, review_status)
       VALUES
         ($1, COALESCE($2, slugify($1)), $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12)
       RETURNING id, name, slug, category, aliases, summary, description,
                 treatment_time, results_timeline, results_duration, recovery_time,
                 faqs, review_status, is_active, created_at, updated_at`,
      [
        input.name,
        input.slug ?? null,
        input.category ?? null,
        input.aliases ?? null,
        input.summary ?? null,
        input.description ?? null,
        input.treatment_time ?? null,
        input.results_timeline ?? null,
        input.results_duration ?? null,
        input.recovery_time ?? null,
        input.faqs ? JSON.stringify(input.faqs) : '[]',
        input.review_status ?? null,
      ]
    );

    return successResponse(rows[0], 201);
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      return handleApiError(ApiError.conflict("A service with that slug already exists"));
    }
    return handleApiError(err);
  }
}
