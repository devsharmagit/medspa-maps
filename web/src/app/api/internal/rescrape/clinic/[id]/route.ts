/**
 * POST /api/internal/rescrape/clinic/[id] — refresh ONE clinic's treatments and
 * concerns, and record what changed.
 *
 * Runs the SAME engine as the two admin import buttons (see
 * lib/rescrape/refresh-clinic.ts → lib/ingest/ingest-treatments-concerns.ts), so
 * a scheduled refresh and an admin import can never disagree about a clinic's
 * menu. Called once per clinic by the cron server. Auth: the shared
 * X-Internal-Secret header (INTERNAL_API_SECRET).
 *
 * Returns the per-clinic summary { clinicId, runId, added[], removed[], ok, … }.
 */

import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { successResponse, handleApiError } from "@/lib/api-response";
import { refreshClinicById } from "@/lib/rescrape/refresh-clinic";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Crawling ~130 pages and running several AI batches takes minutes. The engine
// also enforces its own wall-clock budget (REFRESH_BUDGET_MS) so a wedged run
// degrades into a skipped save rather than hanging indefinitely.
export const maxDuration = 600;

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: RouteContext) {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  try {
    const { id } = await params;
    return successResponse(await refreshClinicById(id));
  } catch (err) {
    return handleApiError(err);
  }
}
