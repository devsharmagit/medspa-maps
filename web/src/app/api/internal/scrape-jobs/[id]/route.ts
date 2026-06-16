/**
 * PATCH /api/internal/scrape-jobs/[id]
 * Body: { status, error_message?, services_found?, providers_found?, images_found? }
 *
 * Updates a scrape job's status and result counters.
 */

export const dynamic = "force-dynamic";

import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { ourQuery } from "@/lib/sync/db-helpers";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  const { id } = await params;
  const body = await req.json() as {
    status: "done" | "failed";
    error_message?: string;
    services_found?: number;
    providers_found?: number;
    images_found?: number;
  };

  if (!body.status) {
    return Response.json({ error: "status is required" }, { status: 400 });
  }

  await ourQuery(
    `UPDATE scrape_jobs SET
       status          = $1,
       finished_at     = NOW(),
       error_message   = $2,
       services_found  = COALESCE($3, services_found),
       providers_found = COALESCE($4, providers_found),
       images_found    = COALESCE($5, images_found),
       updated_at      = NOW()
     WHERE id = $6`,
    [
      body.status,
      body.error_message ?? null,
      body.services_found ?? null,
      body.providers_found ?? null,
      body.images_found ?? null,
      id,
    ]
  );

  return Response.json({ ok: true });
}
