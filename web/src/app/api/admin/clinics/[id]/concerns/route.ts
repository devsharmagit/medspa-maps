import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { query } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { successResponse, handleApiError } from "@/lib/api-response";
import { CANONICAL_CONCERNS } from "@/lib/taxonomy/canonical";
import {
  getClinicMatchedServiceSlugs,
  deriveConcernSlugs,
  getEffectiveConcernSlugs,
  saveClinicConcerns,
} from "@/lib/concerns/clinic-concerns";

const priorityConcernSlugs = CANONICAL_CONCERNS.map((concern) => concern.slug);

const putSchema = z.object({
  concern_slugs: z.array(z.enum(priorityConcernSlugs as [string, ...string[]])),
});

// GET /api/admin/clinics/[id]/concerns — effective + derived concern slugs
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const clinic = await query<{ id: string }>(
      `SELECT id FROM clinics WHERE id = $1`,
      [id]
    );
    if (clinic.length === 0) throw ApiError.notFound("Clinic not found");

    const matched = await getClinicMatchedServiceSlugs(id);
    const derived_concern_slugs = deriveConcernSlugs(matched);
    const effective_concern_slugs = await getEffectiveConcernSlugs(id);

    return successResponse({ effective_concern_slugs, derived_concern_slugs });
  } catch (err) {
    return handleApiError(err);
  }
}

// PUT /api/admin/clinics/[id]/concerns — persist concern overrides
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: clinicId } = await params;
    const body = await req.json();
    const { concern_slugs } = putSchema.parse(body);

    const clinic = await query<{ id: string }>(
      `SELECT id FROM clinics WHERE id = $1`,
      [clinicId]
    );
    if (clinic.length === 0) throw ApiError.notFound("Clinic not found");

    const effective_concern_slugs = await saveClinicConcerns(clinicId, concern_slugs);

    return successResponse({ effective_concern_slugs });
  } catch (err) {
    return handleApiError(err);
  }
}
