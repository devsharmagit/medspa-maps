/**
 * POST /api/internal/sync/business
 * Body: { g99BusinessId: string }
 *
 * Fetches the full G99 bundle for one business and syncs it into our DB.
 * All G99 reads and our DB writes happen here — the cron server has no DB access.
 */

export const dynamic = "force-dynamic";

import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { fetchG99BusinessBundle } from "@/lib/sync/g99-sync";

export async function POST(req: Request): Promise<Response> {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  const body = await req.json() as { g99BusinessId?: string };
  if (!body.g99BusinessId) {
    return Response.json({ error: "g99BusinessId is required" }, { status: 400 });
  }

  const g99Id = BigInt(body.g99BusinessId);
  const bundle = await fetchG99BusinessBundle(g99Id);


  return Response.json({ ok: true, name: bundle.business });
}
