import { isInternalAuthorized, unauthorizedResponse } from "@/lib/internal-auth";
import { query } from "@/lib/db";
import { successResponse, errorResponse, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

interface ServiceRow {
  raw_name: string;
  description?: string;
  scraped_from_url?: string;
}

interface ImageRow {
  source_url: string;
  role: string;
  alt_text?: string;
  sort_order?: number;
  scraped_domain?: string;
}

interface ScrapePayload {
  clinicId: string;
  businessId: string;
  scrapeResult: {
    scraped_at: string;
    business: { business_images: ImageRow[] };
    clinics: Array<{ services: ServiceRow[]; images: ImageRow[] }>;
  };
}

export async function POST(req: Request) {
  if (!isInternalAuthorized(req)) return unauthorizedResponse();

  let body: ScrapePayload;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON", 400);
  }

  const { clinicId, businessId, scrapeResult } = body;
  if (!clinicId || !businessId || !scrapeResult) {
    return errorResponse("Missing required fields", 400);
  }

  try {
    const { scraped_at, business, clinics } = scrapeResult;

    // Merge services from all clinic entries (they're shared across locations)
    const serviceMap = new Map<string, ServiceRow>();
    for (const c of clinics) {
      for (const svc of c.services ?? []) {
        if (svc.raw_name && !serviceMap.has(svc.raw_name)) {
          serviceMap.set(svc.raw_name, svc);
        }
      }
    }

    // Merge clinic images (deduped by source_url)
    const clinicImageMap = new Map<string, ImageRow>();
    for (const c of clinics) {
      for (const img of c.images ?? []) {
        if (img.source_url && !clinicImageMap.has(img.source_url)) {
          clinicImageMap.set(img.source_url, img);
        }
      }
    }

    let servicesSaved = 0;
    let imagesSaved = 0;

    // Upsert clinic services
    for (const svc of serviceMap.values()) {
      if (!svc.raw_name?.trim()) continue;
      await query(
        `INSERT INTO clinic_services
           (clinic_id, raw_name, description, data_source, scraped_from_url, last_scraped_at)
         VALUES ($1, $2, $3, 'scraped', $4, $5)
         ON CONFLICT (clinic_id, raw_name) DO UPDATE SET
           last_scraped_at = EXCLUDED.last_scraped_at,
           is_active       = true,
           updated_at      = NOW()`,
        [
          clinicId,
          svc.raw_name.trim(),
          svc.description ?? null,
          svc.scraped_from_url ?? null,
          scraped_at,
        ]
      );
      servicesSaved++;
    }

    // Upsert clinic images (cover + gallery, not logo)
    let sortOrder = 0;
    for (const img of clinicImageMap.values()) {
      if (!img.source_url || img.role === "logo") continue;
      await query(
        `INSERT INTO images
           (entity_type, entity_id, source_url, role, alt_text, sort_order, scraped_domain, scrape_status)
         VALUES ('clinic', $1, $2, $3, $4, $5, $6, 'ok')
         ON CONFLICT (entity_type, entity_id, source_url) DO UPDATE SET
           scrape_status = 'ok',
           updated_at    = NOW()`,
        [
          clinicId,
          img.source_url,
          img.role ?? "gallery",
          img.alt_text ?? null,
          img.sort_order ?? sortOrder,
          img.scraped_domain ?? null,
        ]
      );
      sortOrder++;
      imagesSaved++;
    }

    // Upsert business logo
    for (const img of business?.business_images ?? []) {
      if (!img.source_url) continue;
      await query(
        `INSERT INTO images
           (entity_type, entity_id, source_url, role, alt_text, sort_order, scraped_domain, scrape_status)
         VALUES ('business', $1, $2, $3, $4, $5, $6, 'ok')
         ON CONFLICT (entity_type, entity_id, source_url) DO UPDATE SET
           scrape_status = 'ok',
           updated_at    = NOW()`,
        [
          businessId,
          img.source_url,
          img.role ?? "logo",
          img.alt_text ?? null,
          img.sort_order ?? 0,
          img.scraped_domain ?? null,
        ]
      );
      imagesSaved++;
    }

    // Update last_scraped_at on the clinic
    await query(
      "UPDATE clinics SET last_scraped_at = $1, updated_at = NOW() WHERE id = $2",
      [scraped_at, clinicId]
    );

    return successResponse({ services_saved: servicesSaved, images_saved: imagesSaved });
  } catch (err) {
    return handleApiError(err);
  }
}
