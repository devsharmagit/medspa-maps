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
// Crawling ~130 pages and running several AI batches takes minutes.
//
// Must stay <= 300: Vercel validates this at BUILD time and Hobby's ceiling is
// 300s, so a higher value fails the preview deploy outright. It costs nothing to
// cap it here — on the real ECS deployment `maxDuration` is an inert hint that
// `next start` never enforces, and the actual bound is the engine's own
// REFRESH_BUDGET_MS (240s, in lib/rescrape/refresh-clinic.ts), which degrades a
// wedged run into a recorded `skipped` save rather than hanging.
export const maxDuration = 300;

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
