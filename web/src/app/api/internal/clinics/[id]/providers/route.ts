/**
 * POST /api/internal/clinics/[id]/providers
 * Body: { providers: ScrapedProvider[], business_id: string }
 *
 * Upserts scraped providers into the providers table and links them
 * to the clinic via clinic_providers. For non-G99 clinics only.
 */

export const dynamic = "force-dynamic";

import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { ourQuery, ourQueryOne, slugify, uniqueSlug } from "@/lib/sync/db-helpers";
import type { ScrapedProvider } from "@/lib/scraper/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  const { id: clinicId } = await params;
  const body = await req.json() as { providers: ScrapedProvider[]; business_id: string };

  if (!Array.isArray(body.providers)) {
    return Response.json({ error: "providers must be an array" }, { status: 400 });
  }
  if (!body.business_id) {
    return Response.json({ error: "business_id is required" }, { status: 400 });
  }

  let upserted = 0;

  for (const p of body.providers) {
    if (!p.name || p.name.length < 2) continue;

    const baseSlug = slugify(p.name);
    if (!baseSlug) continue;

    // Check if provider already exists in this business
    const existing = await ourQueryOne<{ id: string }>(
      `SELECT id FROM providers WHERE business_id = $1 AND slug = $2`,
      [body.business_id, baseSlug]
    );

    let providerId: string;

    if (existing) {
      providerId = existing.id;
      // Update non-null fields
      await ourQuery(
        `UPDATE providers SET
           title       = COALESCE($1, title),
           designation = COALESCE($2, designation),
           bio         = COALESCE($3, bio),
           photo_url   = COALESCE($4, photo_url),
           last_scraped_at = NOW(),
           updated_at  = NOW()
         WHERE id = $5`,
        [
          p.title ?? null, p.designation ?? null,
          p.bio ?? null, p.photo_url ?? null,
          providerId,
        ]
      );
    } else {
      const slug = await uniqueSlug(baseSlug, "providers");
      const row = await ourQueryOne<{ id: string }>(
        `INSERT INTO providers (
           business_id, name, slug, title, designation, bio, photo_url,
           specializations, data_source, last_scraped_at, is_active
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scraped', NOW(), true)
         RETURNING id`,
        [
          body.business_id, p.name, slug,
          p.title ?? null, p.designation ?? null,
          p.bio ?? null, p.photo_url ?? null,
          p.specializations ?? null,
        ]
      );
      if (!row) continue;
      providerId = row.id;
    }

    // Link provider to clinic
    await ourQuery(
      `INSERT INTO clinic_providers (clinic_id, provider_id, is_active)
       VALUES ($1, $2, true)
       ON CONFLICT (clinic_id, provider_id) DO UPDATE SET is_active = true`,
      [clinicId, providerId]
    );

    // Upsert provider photo to images table
    if (p.photo_url) {
      await ourQuery(
        `INSERT INTO images (entity_type, entity_id, source_url, role, scrape_status, sort_order)
         VALUES ('provider', $1, $2, 'avatar', 'ok', 0)
         ON CONFLICT (entity_type, entity_id, source_url) DO UPDATE SET scrape_status = 'ok'`,
        [providerId, p.photo_url]
      );
    }

    upserted++;
  }

  return Response.json({ ok: true, upserted, total: body.providers.length });
}
