/**
 * POST /api/internal/scrape-jobs
 * Body: { clinic_id: string, target_url: string, job_type: string }
 *
 * Creates a new scrape job record. Returns the job ID for status tracking.
 */

export const dynamic = "force-dynamic";

import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { ourQueryOne } from "@/lib/sync/db-helpers";

export async function POST(req: Request): Promise<Response> {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  const body = await req.json() as {
    clinic_id: string;
    target_url: string;
    job_type: string;
  };

  if (!body.clinic_id || !body.target_url || !body.job_type) {
    return Response.json(
      { error: "clinic_id, target_url, and job_type are required" },
      { status: 400 }
    );
  }

  const row = await ourQueryOne<{ id: string }>(
    `INSERT INTO scrape_jobs (clinic_id, target_url, job_type, status, started_at)
     VALUES ($1, $2, $3, 'running', NOW())
     RETURNING id`,
    [body.clinic_id, body.target_url, body.job_type]
  );

  return Response.json({ ok: true, job_id: row!.id });
}
