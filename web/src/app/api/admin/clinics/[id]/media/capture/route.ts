/**
 * POST /api/admin/clinics/[id]/media/capture — capture stored image copies for a
 * clinic (all images + provider headshots) that aren't captured yet. Called from
 * the clinic edit page after "Save Clinic" so newly pasted image URLs get a
 * durable fallback copy.
 */

import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { successResponse, handleApiError } from "@/lib/api-response";
import { captureClinic } from "@/lib/media/blobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await params;
    const result = await captureClinic(id);
    return successResponse({ clinicId: id, ...result });
  } catch (err) {
    return handleApiError(err);
  }
}
