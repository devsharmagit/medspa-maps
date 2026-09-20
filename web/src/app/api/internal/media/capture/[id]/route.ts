/**
 * POST /api/internal/media/capture/[id] — recapture the stored image copies for
 * ONE clinic (all images + provider headshots). Called by the cron server for
 * monthly freshness/durability. A source 404 keeps the existing bytes.
 *
 * Auth: the shared X-Internal-Secret header (INTERNAL_API_SECRET).
 */

import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { successResponse, handleApiError } from "@/lib/api-response";
import { captureClinic } from "@/lib/media/blobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteContext) {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  try {
    const { id } = await params;
    const result = await captureClinic(id);
    return successResponse({ clinicId: id, ...result });
  } catch (err) {
    return handleApiError(err);
  }
}
