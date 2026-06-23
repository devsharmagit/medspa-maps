/**
 * admin/clinic-save.ts — persist a save-ready clinic bundle.
 *
 * saveClinicBundle() takes the SAVE-READY payload produced by
 * scrapeClinicPreview() (or assembled in the admin UI) and writes:
 *   - ONE business row
 *   - N clinic rows (one per payload.locations entry) keyed by website domain
 *   - clinic_services (each mapped via matchService → service_id/match_status/
 *     match_confidence; unmatched ones kept with service_id NULL)
 *   - images (logo / gallery / before_after — source_url only)
 *   - reviews
 *   - concern_services links (derived from CANONICAL_CONCERNS.serviceKeywords
 *     against the clinic's matched canonical services)
 *
 * Dedup / overwrite is keyed by WEBSITE DOMAIN: existing clinics whose website
 * resolves to the same hostname are reused. Providers and pricing are skipped.
 *
 * Pure DB logic (no HTTP/auth). Mirrors the upsert patterns in
 * scripts/ingest-all.ts.
 */

import { createHash } from "node:crypto";
import { query, queryOne } from "@/lib/db";
import { slugify } from "@/lib/scraper/utils";
import {
  matchService,
  CANONICAL_CONCERNS,
} from "@/lib/taxonomy/canonical";

// ── Payload shape (also produced by scrapeClinicPreview) ─────────────────────

export interface SaveBusiness {
  name: string;
}

export interface SaveLocation {
  /** location name / tagline (e.g. the branch or city) shown on the clinic page */
  tagline?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
  phone?: string | null;
  email?: string | null;
  about?: string | null;
  booking_url?: string | null;
  maps_url?: string | null;
  hours?: Record<string, unknown> | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  tiktok_url?: string | null;
  youtube_url?: string | null;
  x_url?: string | null;
  linkedin_url?: string | null;
  yelp_url?: string | null;
  google_my_business?: string | null;
}

export interface SaveServiceSuggestion {
  slug: string;
  confidence: number;
}

export interface SaveService {
  raw_name: string;
  description?: string | null;
  scraped_from_url?: string | null;
  /** advisory; saveClinicBundle re-runs matchService for the authoritative result */
  suggestion?: SaveServiceSuggestion | null;
  is_noise?: boolean;
  /** explicit admin override → map this raw name to this canonical service slug */
  mapped_slug?: string | null;
  /** admin chose to drop this raw service from the save entirely */
  ignored?: boolean;
}

export interface SaveImageRef {
  source_url: string;
  alt_text?: string | null;
}

export interface SaveImages {
  logo?: SaveImageRef | null;
  gallery?: SaveImageRef[];
  before_after?: SaveImageRef[];
}

export interface SaveReview {
  reviewer_name?: string | null;
  rating?: number | null;
  body: string;
  source_url?: string | null;
}

export interface ClinicBundle {
  /** canonical website (its hostname is the dedup key) */
  website: string;
  business: SaveBusiness;
  locations: SaveLocation[];
  services: SaveService[];
  images?: SaveImages;
  reviews?: SaveReview[];
  /** aggregate rating, if known */
  ext_rating?: number | null;
  ext_review_count?: number | null;
}

export interface SaveClinicResult {
  businessId: string;
  businessCreated: boolean;
  clinics: Array<{ id: string; slug: string; created: boolean }>;
  servicesMatched: number;
  servicesAuto: number;
  servicesUnmatched: number;
  images: number;
  reviews: number;
  concernLinks: number;
}

const hash = (s: string) => createHash("sha1").update(s).digest("hex");

/** Hostname (no leading www.) used as the website dedup key. */
export function websiteDomain(website: string): string {
  try {
    const u = new URL(website.startsWith("http") ? website : `https://${website}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return website.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  }
}

/** Find clinic ids whose website matches the given domain (host-insensitive). */
export async function findClinicsByDomain(domain: string): Promise<string[]> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM clinics
      WHERE lower(regexp_replace(regexp_replace(website, '^https?://', ''), '^www\\.', '')) LIKE $1`,
    [`${domain}%`]
  );
  return rows.map((r) => r.id);
}

/** Unique clinic slug within a business (the natural key clinics(business_id, slug)). */
async function uniqueClinicSlug(base: string, businessId: string): Promise<string> {
  let slug = base || "clinic";
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM clinics WHERE business_id = $1 AND slug = $2`,
      [businessId, slug]
    );
    if (!existing) return slug;
    slug = `${base}-${n++}`;
  }
}

/**
 * saveClinicBundle(payload, { overwrite }) — upsert the whole bundle.
 *
 * overwrite (default true): when an existing clinic is found by website domain,
 * its rows are refreshed in place (services/images deleted+reinserted). When
 * false, an existing clinic keeps its current services/images and only fills
 * NULL columns; nothing destructive happens.
 */
export async function saveClinicBundle(
  payload: ClinicBundle,
  opts: { overwrite?: boolean } = {}
): Promise<SaveClinicResult> {
  const overwrite = opts.overwrite ?? true;
  const domain = websiteDomain(payload.website);
  const website = payload.website.startsWith("http")
    ? payload.website
    : `https://${payload.website}`;
  const bizName = payload.business.name?.trim() || domain;

  // ── business (one per bundle; dedupe by name) ──────────────────────────────
  let businessId: string;
  let businessCreated = false;
  const existingBiz = await queryOne<{ id: string }>(
    `SELECT id FROM businesses WHERE name = $1 ORDER BY created_at LIMIT 1`,
    [bizName]
  );
  if (existingBiz) {
    businessId = existingBiz.id;
  } else {
    const ins = await queryOne<{ id: string }>(
      `INSERT INTO businesses (name, tier, verified, data_source, last_synced_at)
       VALUES ($1, 'free', false, 'scraped', NOW()) RETURNING id`,
      [bizName]
    );
    businessId = ins!.id;
    businessCreated = true;
  }

  // existing clinics for this domain (overwrite targets / dedup)
  const existingClinicIds = await findClinicsByDomain(domain);

  const result: SaveClinicResult = {
    businessId,
    businessCreated,
    clinics: [],
    servicesMatched: 0,
    servicesAuto: 0,
    servicesUnmatched: 0,
    images: 0,
    reviews: 0,
    concernLinks: 0,
  };

  const locations = payload.locations.length > 0 ? payload.locations : [{}];
  const touchedClinicIds: string[] = [];

  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];
    const discriminator =
      loc.city ?? (locations.length > 1 ? `Location ${i + 1}` : null);
    const clinicName = discriminator ? `${bizName} – ${discriminator}` : bizName;
    const slugBase = slugify(clinicName);

    // Reuse an existing clinic for this domain that hasn't been claimed yet in
    // this run; otherwise create a new one.
    let clinicId: string | null = null;
    for (const id of existingClinicIds) {
      if (!touchedClinicIds.includes(id)) {
        // prefer a slug match when multiple exist; else first free one
        const match = await queryOne<{ id: string }>(
          `SELECT id FROM clinics WHERE id = $1 AND slug = $2`,
          [id, slugBase]
        );
        if (match || existingClinicIds.length === locations.length) {
          clinicId = id;
          break;
        }
      }
    }
    if (clinicId === null) {
      const free = existingClinicIds.find((id) => !touchedClinicIds.includes(id));
      if (free) clinicId = free;
    }

    let created = false;
    let slug = slugBase;

    if (clinicId) {
      const setOrOverwrite = (col: string, idx: number) =>
        overwrite ? `${col} = $${idx}` : `${col} = COALESCE($${idx}, ${col})`;
      await query(
        `UPDATE clinics SET
            name = $2,
            website = $3,
            ${setOrOverwrite("booking_url", 4)},
            ${setOrOverwrite("address", 5)},
            ${setOrOverwrite("city", 6)},
            ${setOrOverwrite("state", 7)},
            ${setOrOverwrite("zip", 8)},
            ${setOrOverwrite("phone", 9)},
            ${setOrOverwrite("email", 10)},
            ${setOrOverwrite("about", 11)},
            ${setOrOverwrite("instagram_url", 12)},
            ${setOrOverwrite("facebook_url", 13)},
            ${setOrOverwrite("tiktok_url", 14)},
            ${setOrOverwrite("youtube_url", 15)},
            ${setOrOverwrite("tagline", 16)},
            ${setOrOverwrite("google_maps_url", 17)},
            ${setOrOverwrite("x_url", 18)},
            ${setOrOverwrite("linkedin_url", 19)},
            ${setOrOverwrite("yelp_url", 20)},
            ${setOrOverwrite("google_my_business", 21)},
            data_source = 'scraped',
            last_scraped_at = NOW(),
            updated_at = NOW()
          WHERE id = $1`,
        [
          clinicId, clinicName, website, loc.booking_url ?? null, loc.address ?? null,
          loc.city ?? null, loc.state ?? null, loc.zip ?? null, loc.phone ?? null,
          loc.email ?? null, loc.about ?? null, loc.instagram_url ?? null,
          loc.facebook_url ?? null, loc.tiktok_url ?? null, loc.youtube_url ?? null,
          loc.tagline ?? null, loc.maps_url ?? null, loc.x_url ?? null,
          loc.linkedin_url ?? null, loc.yelp_url ?? null, loc.google_my_business ?? null,
        ]
      );
    } else {
      slug = await uniqueClinicSlug(slugBase, businessId);
      const ins = await queryOne<{ id: string }>(
        `INSERT INTO clinics
           (business_id, name, slug, website, booking_url, address, city, state, zip,
            phone, email, about, instagram_url, facebook_url, tiktok_url, youtube_url,
            tagline, google_maps_url, x_url, linkedin_url, yelp_url, google_my_business,
            data_source, verified, last_scraped_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,'scraped',false,NOW())
         RETURNING id`,
        [
          businessId, clinicName, slug, website, loc.booking_url ?? null, loc.address ?? null,
          loc.city ?? null, loc.state ?? null, loc.zip ?? null, loc.phone ?? null,
          loc.email ?? null, loc.about ?? null, loc.instagram_url ?? null,
          loc.facebook_url ?? null, loc.tiktok_url ?? null, loc.youtube_url ?? null,
          loc.tagline ?? null, loc.maps_url ?? null, loc.x_url ?? null,
          loc.linkedin_url ?? null, loc.yelp_url ?? null, loc.google_my_business ?? null,
        ]
      );
      clinicId = ins!.id;
      created = true;
    }

    touchedClinicIds.push(clinicId);
    result.clinics.push({ id: clinicId, slug, created });

    // geo
    if (loc.lat != null && loc.lng != null) {
      await query(
        `UPDATE clinics SET lat = $2::float8::numeric, lng = $3::float8::numeric,
            geo = ST_SetSRID(ST_MakePoint($3::float8, $2::float8), 4326)::geography,
            updated_at = NOW() WHERE id = $1`,
        [clinicId, loc.lat, loc.lng]
      );
    }
    // hours
    if (loc.hours) {
      await query(`UPDATE clinics SET hours = $2::jsonb WHERE id = $1`, [
        clinicId,
        JSON.stringify(loc.hours),
      ]);
    }
    // aggregate rating
    if (payload.ext_rating != null) {
      await query(
        `UPDATE clinics SET ext_rating = $2, ext_review_count = $3 WHERE id = $1`,
        [
          clinicId,
          Math.min(5, Math.max(0, payload.ext_rating)),
          payload.ext_review_count ?? null,
        ]
      );
    }

    // ── services (NEVER skip; unmatched → service_id NULL) ───────────────────
    if (overwrite) {
      await query(`DELETE FROM clinic_services WHERE clinic_id = $1`, [clinicId]);
    }
    const seenRaw = new Set<string>();
    for (const s of payload.services) {
      const raw = s.raw_name?.trim();
      if (!raw) continue;
      // Admin explicitly dropped this raw service in the wizard.
      if (s.ignored) continue;
      const rawKey = raw.toLowerCase();
      if (seenRaw.has(rawKey)) continue;
      seenRaw.add(rawKey);

      let serviceId: string | null = null;
      let confidence = 0;
      let matchStatus: "matched" | "auto" | "unmatched";

      if (s.mapped_slug) {
        // Explicit admin mapping (e.g. picked from the dropdown or just-created
        // via "Create service") takes precedence over auto-matching.
        const svc = await queryOne<{ id: string }>(
          `SELECT id FROM services WHERE slug = $1`,
          [s.mapped_slug]
        );
        serviceId = svc?.id ?? null;
        confidence = serviceId ? 1 : 0;
        matchStatus = serviceId ? "matched" : "unmatched";
      } else {
        const { slug: canonSlug, confidence: conf } = matchService(raw);
        confidence = conf;
        if (canonSlug) {
          const svc = await queryOne<{ id: string }>(
            `SELECT id FROM services WHERE slug = $1`,
            [canonSlug]
          );
          serviceId = svc?.id ?? null;
          matchStatus = serviceId ? (confidence >= 1 ? "matched" : "auto") : "unmatched";
        } else {
          matchStatus = "unmatched";
        }
      }
      if (matchStatus === "matched") result.servicesMatched++;
      else if (matchStatus === "auto") result.servicesAuto++;
      else result.servicesUnmatched++;

      await query(
        `INSERT INTO clinic_services
           (clinic_id, service_id, raw_name, description, match_status, match_confidence,
            data_source, scraped_from_url, last_scraped_at)
         VALUES ($1,$2,$3,$4,$5,$6,'scraped',$7,NOW())
         ON CONFLICT (clinic_id, raw_name) DO UPDATE SET
           service_id = EXCLUDED.service_id,
           description = COALESCE(EXCLUDED.description, clinic_services.description),
           match_status = EXCLUDED.match_status,
           match_confidence = EXCLUDED.match_confidence,
           last_scraped_at = NOW(),
           updated_at = NOW()`,
        [clinicId, serviceId, raw, s.description ?? null, matchStatus, confidence || null,
         s.scraped_from_url ?? website]
      );
    }

    // ── images (logo / gallery / before_after; source_url only) ──────────────
    const insertImg = async (img: SaveImageRef, role: string, order: number) => {
      if (!img.source_url) return;
      const res = await query<{ id: string }>(
        `INSERT INTO images
           (entity_type, entity_id, source_url, role, sort_order, alt_text, scraped_domain, scrape_status)
         VALUES ('clinic',$1,$2,$3,$4,$5,$6,'ok')
         ON CONFLICT (entity_type, entity_id, source_url) DO NOTHING
         RETURNING id`,
        [clinicId, img.source_url, role, order, img.alt_text ?? null, domain]
      );
      result.images += res.length;
    };
    const imgs = payload.images;
    if (imgs?.logo) await insertImg(imgs.logo, "logo", 0);
    let go = 0;
    for (const g of imgs?.gallery ?? []) await insertImg(g, "gallery", go++);
    let bo = 0;
    for (const b of imgs?.before_after ?? []) await insertImg(b, "before_after", bo++);

    // ── reviews ───────────────────────────────────────────────────────────────
    for (const rev of payload.reviews ?? []) {
      if (!rev.body) continue;
      const ch = hash(domain + "|" + clinicId.slice(0, 8) + "|" + rev.body.slice(0, 120));
      const res = await query<{ id: string }>(
        `INSERT INTO reviews
           (clinic_id, rating, body, reviewer_name, source, source_url, content_hash, data_source)
         VALUES ($1,$2,$3,$4,'scraped',$5,$6,'scraped')
         ON CONFLICT (content_hash) DO NOTHING RETURNING id`,
        [clinicId, rev.rating ?? null, rev.body, rev.reviewer_name ?? null, rev.source_url ?? null, ch]
      );
      result.reviews += res.length;
    }

    // ── concern_services for this clinic's matched canonical services ────────
    result.concernLinks += await deriveConcernServicesForClinic(clinicId);
  }

  return result;
}

/**
 * Link concerns to the canonical services this clinic actually offers (matched
 * service_id), using CANONICAL_CONCERNS.serviceKeywords against the service
 * name. Mirrors ingest-all.ts deriveConcernServices but scoped to one clinic.
 */
async function deriveConcernServicesForClinic(clinicId: string): Promise<number> {
  const svcRows = await query<{ id: string; name: string }>(
    `SELECT DISTINCT s.id, s.name
       FROM services s
       JOIN clinic_services cs ON cs.service_id = s.id
      WHERE cs.clinic_id = $1 AND s.is_active = true`,
    [clinicId]
  );
  if (svcRows.length === 0) return 0;

  let links = 0;
  for (const def of CANONICAL_CONCERNS) {
    const concern = await queryOne<{ id: string }>(
      `SELECT id FROM concerns WHERE slug = $1`,
      [def.slug]
    );
    if (!concern) continue;
    let order = 0;
    for (const svc of svcRows) {
      const nm = svc.name.toLowerCase();
      const included = def.serviceKeywords.some((k) => nm.includes(k.toLowerCase()));
      if (!included) continue;
      const res = await query<{ id: string }>(
        `INSERT INTO concern_services (concern_id, service_id, display_order)
         VALUES ($1,$2,$3) ON CONFLICT (concern_id, service_id) DO NOTHING RETURNING id`,
        [concern.id, svc.id, order++]
      );
      links += res.length;
    }
  }
  return links;
}
