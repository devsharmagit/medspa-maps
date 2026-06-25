import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { ApiError } from "@/lib/errors";
import { query } from "@/lib/db";
import { successResponse, handleApiError } from "@/lib/api-response";
import { createProvider, getProvidersByClinicId } from "@/lib/providers/queries";

const credentialSchema = z.object({
  title: z.string().min(1),
  institution: z.string().min(1),
});

const specialtySchema = z.object({
  title: z.string().min(1),
  description: z.string(),
});

const createProviderSchema = z.object({
  name: z.string().min(1, "Provider name is required").max(255),
  title: z.string().max(255).nullish(),
  bio: z.string().nullish(),
  image_url: z.string().url("Must be a valid URL").nullish(),
  years_experience: z.number().int().positive().nullish(),
  is_verified: z.boolean().optional(),
  highlights: z.array(z.string()).optional(),
  credentials: z.array(credentialSchema).optional(),
  specialties: z.array(specialtySchema).optional(),
  service_ids: z.array(z.string().uuid()).optional(),
});

// GET /api/admin/clinics/[id]/providers — list providers for a clinic
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const providers = await getProvidersByClinicId(id);
    return successResponse(providers);
  } catch (err) {
    return handleApiError(err);
  }
}

// POST /api/admin/clinics/[id]/providers — create provider for a clinic
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const input = createProviderSchema.parse(body);

    // Validate that all service_ids reference existing active services
    if (input.service_ids && input.service_ids.length > 0) {
      const placeholders = input.service_ids.map((_, i) => `$${i + 1}`).join(", ");
      const existing = await query<{ id: string }>(
        `SELECT id FROM services WHERE id IN (${placeholders}) AND is_active = true`,
        input.service_ids
      );
      const existingIds = new Set(existing.map((r) => r.id));
      const invalid = input.service_ids.filter((sid) => !existingIds.has(sid));
      if (invalid.length > 0) {
        throw ApiError.badRequest(
          `The following service IDs are invalid or inactive: ${invalid.join(", ")}`
        );
      }
    }

    const provider = await createProvider(id, {
      name: input.name,
      title: input.title ?? null,
      bio: input.bio ?? null,
      image_url: input.image_url ?? null,
      years_experience: input.years_experience ?? null,
      is_verified: input.is_verified ?? false,
      highlights: input.highlights ?? [],
      credentials: input.credentials ?? [],
      specialties: input.specialties ?? [],
      service_ids: input.service_ids ?? [],
    });

    return successResponse(provider, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
