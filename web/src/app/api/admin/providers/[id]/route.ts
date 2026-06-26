import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { ApiError } from "@/lib/errors";
import { query } from "@/lib/db";
import { successResponse, handleApiError } from "@/lib/api-response";
import {
  getProviderById,
  getProviderServiceIds,
  getProviderConcernIds,
  updateProvider,
  deleteProvider,
} from "@/lib/providers/queries";

const credentialSchema = z.object({
  title: z.string().min(1),
  institution: z.string().min(1),
});

const specialtySchema = z.object({
  title: z.string().min(1),
  description: z.string(),
});

const updateProviderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  title: z.string().max(255).nullish(),
  bio: z.string().nullish(),
  image_url: z.string().url("Must be a valid URL").nullish(),
  years_experience: z.number().int().positive().nullish(),
  is_verified: z.boolean().optional(),
  highlights: z.array(z.string()).optional(),
  credentials: z.array(credentialSchema).optional(),
  specialties: z.array(specialtySchema).optional(),
  service_ids: z.array(z.string().uuid()).optional(),
  concern_ids: z.array(z.string().uuid()).optional(),
});

// GET /api/admin/providers/[id] — fetch full provider
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const provider = await getProviderById(id);
    if (!provider) throw ApiError.notFound("Provider not found");
    const [service_ids, concern_ids] = await Promise.all([
      getProviderServiceIds(id),
      getProviderConcernIds(id),
    ]);
    return successResponse({ ...provider, service_ids, concern_ids });
  } catch (err) {
    return handleApiError(err);
  }
}

// PUT /api/admin/providers/[id] — update provider
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const input = updateProviderSchema.parse(body);

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

    // Validate that all concern_ids reference existing active concerns
    if (input.concern_ids && input.concern_ids.length > 0) {
      const placeholders = input.concern_ids.map((_, i) => `$${i + 1}`).join(", ");
      const existing = await query<{ id: string }>(
        `SELECT id FROM concerns WHERE id IN (${placeholders}) AND is_active = true`,
        input.concern_ids
      );
      const existingIds = new Set(existing.map((r) => r.id));
      const invalid = input.concern_ids.filter((cid) => !existingIds.has(cid));
      if (invalid.length > 0) {
        throw ApiError.badRequest(
          `The following concern IDs are invalid or inactive: ${invalid.join(", ")}`
        );
      }
    }

    const updated = await updateProvider(id, {
      ...(input.name !== undefined && { name: input.name }),
      title: input.title ?? undefined,
      bio: input.bio ?? undefined,
      image_url: input.image_url ?? undefined,
      years_experience: input.years_experience ?? undefined,
      ...(input.is_verified !== undefined && { is_verified: input.is_verified }),
      ...(input.highlights !== undefined && { highlights: input.highlights }),
      ...(input.credentials !== undefined && { credentials: input.credentials }),
      ...(input.specialties !== undefined && { specialties: input.specialties }),
      ...(input.service_ids !== undefined && { service_ids: input.service_ids }),
      ...(input.concern_ids !== undefined && { concern_ids: input.concern_ids }),
    });

    if (!updated) throw ApiError.notFound("Provider not found");
    return successResponse(updated);
  } catch (err) {
    return handleApiError(err);
  }
}

// DELETE /api/admin/providers/[id] — delete provider
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const deleted = await deleteProvider(id);
    if (!deleted) throw ApiError.notFound("Provider not found");
    return successResponse({ deleted: true });
  } catch (err) {
    return handleApiError(err);
  }
}
