import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { successResponse, handleApiError } from "@/lib/api-response";
import { CANONICAL_SERVICES } from "@/lib/taxonomy/canonical";

const priorityServiceSlugs = CANONICAL_SERVICES.map((service) => service.slug);

const putSchema = z.object({
  service_slugs: z.array(z.enum(priorityServiceSlugs as [string, ...string[]])),
});

interface ClinicServiceRow {
  id: string;
  service_id: string | null;
  service_slug: string | null;
  service_name: string | null;
  raw_name: string;
  description: string | null;
  is_active: boolean;
}

// GET /api/admin/clinics/[id]/services — list services for a specific clinic
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const services = await query<ClinicServiceRow>(
      `SELECT cs.id, cs.service_id, s.slug AS service_slug, s.name AS service_name,
              cs.raw_name, cs.description, cs.is_active
         FROM clinic_services cs
         LEFT JOIN services s ON s.id = cs.service_id
        WHERE cs.clinic_id = $1 AND cs.is_active = true
        ORDER BY COALESCE(s.name, cs.raw_name) ASC`,
      [id]
    );

    return successResponse(services);
  } catch (err) {
    return handleApiError(err);
  }
}

// PUT /api/admin/clinics/[id]/services — replace editable priority treatments
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: clinicId } = await params;
    const body = await req.json();
    const { service_slugs } = putSchema.parse(body);

    const clinic = await query<{ id: string }>(
      `SELECT id FROM clinics WHERE id = $1`,
      [clinicId]
    );
    if (clinic.length === 0) throw ApiError.notFound("Clinic not found");

    const priorityServices = await query<{
      id: string;
      name: string;
      slug: string;
    }>(
      `SELECT id, name, slug
         FROM services
        WHERE slug = ANY($1::text[]) AND is_active = true`,
      [priorityServiceSlugs]
    );

    const bySlug = new Map(priorityServices.map((service) => [service.slug, service]));
    const missing = service_slugs.filter((slug) => !bySlug.has(slug));
    if (missing.length > 0) {
      throw ApiError.badRequest(`Unknown service slug: ${missing.join(", ")}`);
    }

    const priorityIds = priorityServices.map((service) => service.id);
    if (priorityIds.length > 0) {
      await query(
        `UPDATE clinic_services
            SET is_active = false, updated_at = NOW()
          WHERE clinic_id = $1 AND service_id = ANY($2::uuid[])`,
        [clinicId, priorityIds]
      );
    }

    for (const slug of service_slugs) {
      const service = bySlug.get(slug);
      if (!service) continue;
      await query(
        `INSERT INTO clinic_services
           (clinic_id, service_id, raw_name, match_status, match_confidence, data_source, last_scraped_at, is_active)
         VALUES ($1, $2, $3, 'matched', 1, 'manual', NOW(), true)
         ON CONFLICT (clinic_id, raw_name) DO UPDATE SET
           service_id = EXCLUDED.service_id,
           match_status = 'matched',
           match_confidence = 1,
           data_source = 'manual',
           is_active = true,
           updated_at = NOW()`,
        [clinicId, service.id, service.name]
      );
    }

    const services = await query<ClinicServiceRow>(
      `SELECT cs.id, cs.service_id, s.slug AS service_slug, s.name AS service_name,
              cs.raw_name, cs.description, cs.is_active
         FROM clinic_services cs
         LEFT JOIN services s ON s.id = cs.service_id
        WHERE cs.clinic_id = $1 AND cs.is_active = true
        ORDER BY COALESCE(s.name, cs.raw_name) ASC`,
      [clinicId]
    );

    return successResponse(services);
  } catch (err) {
    return handleApiError(err);
  }
}
