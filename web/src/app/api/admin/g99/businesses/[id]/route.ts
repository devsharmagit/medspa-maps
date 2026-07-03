import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { ApiError } from "@/lib/errors";
import { successResponse, handleApiError } from "@/lib/api-response";
import { getG99Business } from "@/lib/g99/source";
import { importedStatusFor, type ImportedInfo } from "@/lib/g99/imported";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/admin/g99/businesses/:id
// Full G99 business detail: every field + website-clinics (with G99 services)
// + per-clinic imported status.
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await params;

    const business = await getG99Business(id);
    if (!business) throw ApiError.notFound("G99 business not found");

    const status = await importedStatusFor(
      business.clinics.map((c) => ({ clinic_id: c.clinic_id, website: c.website }))
    );
    const imported: Record<string, ImportedInfo> = {};
    for (const c of business.clinics) {
      imported[c.clinic_id] = status.get(c.clinic_id) ?? { state: "new", clinicId: null, slug: null };
    }

    return successResponse({ ...business, imported });
  } catch (err) {
    return handleApiError(err);
  }
}
