/**
 * POST /api/internal/clinics/[id]/full-scrape
 * Body: ScrapeResult
 *
 * Saves a complete scrape result for a clinic:
 *   • Updates contact fields on the clinic row
 *   • Upserts services
 *   • Upserts providers (scraped, non-G99)
 *   • Upserts images
 *   • Bumps last_scraped_at
 *
 * Only overwrites DB values with scraped values when the scraped value is non-null.
 * G99-sourced fields (g99_clinic_id etc.) are never touched.
 */

export const dynamic = "force-dynamic";

import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { ourQuery, ourQueryOne, slugify, uniqueSlug } from "@/lib/sync/db-helpers";
import type { ScrapeResult, ScrapedProvider } from "@/lib/scraper/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  const { id: clinicId } = await params;
  const body = await req.json() as ScrapeResult & { job_id?: string };

  // ── Verify clinic exists ────────────────────────────────────────────────────
  const clinic = await ourQueryOne<{ id: string; business_id: string; data_source: string }>(
    "SELECT id, business_id, data_source FROM clinics WHERE id = $1 AND is_active = true",
    [clinicId]
  );
  if (!clinic) {
    return Response.json({ error: "clinic not found" }, { status: 404 });
  }

  const { contact, services, providers, images } = body;

  // ── Update clinic contact fields ────────────────────────────────────────────
  // Never null-out existing values — only fill in blanks
  await ourQuery(
    `UPDATE clinics SET
       phone           = COALESCE(phone, $1),
       email           = COALESCE(email, $2),
       address         = COALESCE(address, $3),
       city            = COALESCE(city, $4),
       state           = COALESCE(state, $5),
       zip             = COALESCE(zip, $6),
       about           = COALESCE(about, $7),
       booking_url     = COALESCE(booking_url, $8),
       hours           = COALESCE(hours, $9::jsonb),
       instagram_url   = COALESCE(instagram_url, $10),
       facebook_url    = COALESCE(facebook_url, $11),
       yelp_url        = COALESCE(yelp_url, $12),
       google_my_business = COALESCE(google_my_business, $13),
       last_scraped_at = NOW(),
       updated_at      = NOW()
     WHERE id = $14`,
    [
      contact.phone ?? null,
      contact.email ?? null,
      contact.address ?? null,
      contact.city ?? null,
      contact.state ?? null,
      contact.zip ?? null,
      contact.about ?? null,
      contact.booking_url ?? null,
      contact.hours ? JSON.stringify(contact.hours) : null,
      contact.instagram_url ?? null,
      contact.facebook_url ?? null,
      contact.yelp_url ?? null,
      contact.google_my_business ?? null,
      clinicId,
    ]
  );

  // ── Upsert services ─────────────────────────────────────────────────────────
  const incomingSlugs = new Set<string>();
  let servicesUpserted = 0;

  for (const svc of services) {
    if (!svc.name || !svc.slug) continue;
    incomingSlugs.add(svc.slug);

    await ourQuery(
      `INSERT INTO services (
         clinic_id, name, slug, description, price_from, price_to,
         price_notes, price_varies, duration_minutes,
         data_source, scraped_from_url, last_scraped_at, is_active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'scraped', $10, NOW(), true)
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
        svc.duration_minutes ?? null, body.url,
      ]
    );
    servicesUpserted++;
  }

  // Soft-delete services not seen this scrape
  if (incomingSlugs.size > 0) {
    const slugList = [...incomingSlugs].map((_, i) => `$${i + 2}`).join(",");
    await ourQuery(
      `UPDATE services SET is_active = false, updated_at = NOW()
       WHERE clinic_id = $1 AND slug NOT IN (${slugList}) AND is_active = true`,
      [clinicId, ...[...incomingSlugs]]
    );
  }

  // ── Upsert providers (scraped, non-G99 only) ────────────────────────────────
  let providersUpserted = 0;

  if (clinic.data_source !== "g99") {
    for (const p of providers) {
      if (!p.name || p.name.length < 2) continue;
      await upsertScrapedProvider(p, clinicId, clinic.business_id);
      providersUpserted++;
    }
  }

  // ── Upsert images ───────────────────────────────────────────────────────────
  let imagesUpserted = 0;
  const domain = (() => {
    try { return new URL(body.url).hostname; } catch { return null; }
  })();

  for (const img of images) {
    if (!img.source_url) continue;
    await ourQuery(
      `INSERT INTO images (
         entity_type, entity_id, source_url, cdn_url, role, sort_order, alt_text,
         scraped_domain, scrape_status
       ) VALUES ('clinic', $1, $2, NULL, $3, $4, $5, $6, 'ok')
       ON CONFLICT (entity_type, entity_id, source_url) DO UPDATE SET
         role         = EXCLUDED.role,
         sort_order   = EXCLUDED.sort_order,
         alt_text     = COALESCE(EXCLUDED.alt_text, images.alt_text),
         scrape_status = 'ok',
         updated_at   = NOW()`,
      [
        clinicId, img.source_url, img.role,
        img.sort_order ?? 0, img.alt_text ?? null, domain,
      ]
    );
    imagesUpserted++;
  }

  // ── Update scrape job if provided ───────────────────────────────────────────
  if (body.job_id) {
    await ourQuery(
      `UPDATE scrape_jobs SET
         status = 'done',
         finished_at = NOW(),
         services_found = $1,
         providers_found = $2,
         images_found = $3,
         updated_at = NOW()
       WHERE id = $4`,
      [servicesUpserted, providersUpserted, imagesUpserted, body.job_id]
    );
  }

  return Response.json({
    ok: true,
    saved: {
      services: servicesUpserted,
      providers: providersUpserted,
      images: imagesUpserted,
    },
  });
}

async function upsertScrapedProvider(
  p: ScrapedProvider,
  clinicId: string,
  businessId: string
): Promise<void> {
  const baseSlug = slugify(p.name);
  if (!baseSlug) return;

  const existing = await ourQueryOne<{ id: string }>(
    "SELECT id FROM providers WHERE business_id = $1 AND slug = $2",
    [businessId, baseSlug]
  );

  let providerId: string;

  if (existing) {
    providerId = existing.id;
    await ourQuery(
      `UPDATE providers SET
         title           = COALESCE($1, title),
         designation     = COALESCE($2, designation),
         bio             = COALESCE($3, bio),
         photo_url       = COALESCE($4, photo_url),
         last_scraped_at = NOW(),
         updated_at      = NOW()
       WHERE id = $5`,
      [p.title ?? null, p.designation ?? null, p.bio ?? null, p.photo_url ?? null, providerId]
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
        businessId, p.name, slug,
        p.title ?? null, p.designation ?? null,
        p.bio ?? null, p.photo_url ?? null,
        p.specializations?.length ? p.specializations : null,
      ]
    );
    if (!row) return;
    providerId = row.id;
  }

  await ourQuery(
    `INSERT INTO clinic_providers (clinic_id, provider_id, is_active)
     VALUES ($1, $2, true)
     ON CONFLICT (clinic_id, provider_id) DO UPDATE SET is_active = true`,
    [clinicId, providerId]
  );

  if (p.photo_url) {
    await ourQuery(
      `INSERT INTO images (entity_type, entity_id, source_url, role, scrape_status, sort_order)
       VALUES ('provider', $1, $2, 'avatar', 'ok', 0)
       ON CONFLICT (entity_type, entity_id, source_url) DO UPDATE SET scrape_status = 'ok'`,
      [providerId, p.photo_url]
    );
  }
}
