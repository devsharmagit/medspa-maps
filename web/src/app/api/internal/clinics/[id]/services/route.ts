/**
 * POST /api/internal/clinics/[id]/services
 * Body: { services: ScrapedService[], scraped_from_url: string }
 *
 * Upserts per-clinic services scraped from the clinic website.
 * Deactivates services no longer seen (soft-delete).
 */

export const dynamic = "force-dynamic";

import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { ourQuery, ourQueryOne } from "@/lib/sync/db-helpers";
import type { ScrapedService } from "@/lib/scraper/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  const { id: clinicId } = await params;
  const body = await req.json() as { services: ScrapedService[]; scraped_from_url?: string };

  if (!Array.isArray(body.services)) {
    return Response.json({ error: "services must be an array" }, { status: 400 });
  }

  const scrapedUrl = body.scraped_from_url ?? null;
  const incomingSlugs = new Set<string>();
  let upserted = 0;

  for (const svc of body.services) {
    if (!svc.name || !svc.slug) continue;
    incomingSlugs.add(svc.slug);

    await ourQuery(
      `INSERT INTO services (
         clinic_id, name, slug, description, price_from, price_to,
         price_notes, price_varies, duration_minutes,
         data_source, scraped_from_url, last_scraped_at, is_active
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, 'scraped', $10, NOW(), true
       )
       ON CONFLICT (clinic_id, slug) DO UPDATE SET
         name             = EXCLUDED.name,
         description      = COALESCE(EXCLUDED.description, services.description),
         price_from       = COALESCE(EXCLUDED.price_from, services.price_from),
         price_to         = COALESCE(EXCLUDED.price_to, services.price_to),
         price_notes      = COALESCE(EXCLUDED.price_notes, services.price_notes),
         price_varies     = EXCLUDED.price_varies,
         duration_minutes = COALESCE(EXCLUDED.duration_minutes, services.duration_minutes),
         scraped_from_url = EXCLUDED.scraped_from_url,
         last_scraped_at  = NOW(),
         is_active        = true,
         updated_at       = NOW()`,
      [
        clinicId, svc.name, svc.slug, svc.description ?? null,
        svc.price_from ?? null, svc.price_to ?? null,
        svc.price_notes ?? null, svc.price_varies ?? false,
        svc.duration_minutes ?? null, scrapedUrl,
      ]
    );
    upserted++;
  }

  // Soft-delete services that were not seen in this scrape
  if (incomingSlugs.size > 0) {
    const slugList = [...incomingSlugs].map((_, i) => `$${i + 2}`).join(",");
    await ourQuery(
      `UPDATE services SET is_active = false, updated_at = NOW()
       WHERE clinic_id = $1 AND slug NOT IN (${slugList}) AND is_active = true`,
      [clinicId, ...[...incomingSlugs]]
    );
  }

  // Bump clinic last_scraped_at
  await ourQueryOne(
    "UPDATE clinics SET last_scraped_at = NOW(), updated_at = NOW() WHERE id = $1",
    [clinicId]
  );

  return Response.json({ ok: true, upserted, total: body.services.length });
}
