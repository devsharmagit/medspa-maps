/**
 * POST /api/internal/clinics/[id]/images
 * Body: { source_url: string, scraped_domain: string, alt_text?: string, found: boolean }
 *
 * Saves a scraped cover image for a clinic.
 * If found=false, inserts a 'failed' placeholder to skip next run.
 */

export const dynamic = "force-dynamic";

import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { ourQuery } from "@/lib/sync/db-helpers";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  const { id } = await params;
  const body = await req.json() as {
    source_url: string;
    scraped_domain: string;
    alt_text?: string;
    found: boolean;
  };

  if (!body.source_url || !body.scraped_domain) {
    return Response.json({ error: "source_url and scraped_domain are required" }, { status: 400 });
  }

  const scrapeStatus = body.found ? "ok" : "failed";

  await ourQuery(
    `INSERT INTO images (entity_type, entity_id, source_url, scraped_domain, role, sort_order, alt_text, scrape_status)
     VALUES ('clinic', $1, $2, $3, 'cover', 0, $4, $5)
     ON CONFLICT (entity_type, entity_id, source_url) DO UPDATE SET
       scrape_status = EXCLUDED.scrape_status,
       alt_text = EXCLUDED.alt_text`,
    [id, body.source_url, body.scraped_domain, body.alt_text ?? null, scrapeStatus]
  );

  return Response.json({ ok: true });
}
