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
 *   - concern_services links (derived from the curated CANONICAL_CONCERNS
 *     serviceSlugs map against the clinic's matched canonical services)
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
  CANONICAL_SERVICES,
} from "@/lib/taxonomy/canonical";
import { saveClinicConcerns } from "@/lib/concerns/clinic-concerns";

const PRIORITY_SERVICE_SLUG_SET = new Set(CANONICAL_SERVICES.map((s) => s.slug));

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

/**
 * Clinic-wide fields. When present on the bundle, they populate the clinic row
 * directly and the clinic's HEADLINE address/geo/hours/maps are left blank —
 * all location detail lives in clinic_locations and NO location is marked
 * primary. When absent (admin manual-save, demo-setup) the clinic row keeps its
 * legacy behaviour of being derived from locations[0].
 */
export interface SaveClinicLevel {
  booking_url?: string | null;
  about?: string | null;
  tagline?: string | null;
  email?: string | null;
  phone?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  tiktok_url?: string | null;
  youtube_url?: string | null;
  x_url?: string | null;
  linkedin_url?: string | null;
  yelp_url?: string | null;
  google_my_business?: string | null;
}

export interface ClinicBundle {
  /** canonical website (its hostname is the dedup key) */
  website: string;
  business: SaveBusiness;
  /**
   * Optional clinic-wide fields. When present, the clinic row is populated from
   * these and its headline address/geo/hours are left blank (no primary
   * location; every location lives independently in clinic_locations).
   */
  clinic?: SaveClinicLevel;
  locations: SaveLocation[];
  services: SaveService[];
  images?: SaveImages;
  reviews?: SaveReview[];
  /** aggregate rating, if known */
  ext_rating?: number | null;
  ext_review_count?: number | null;
  /**
   * Admin-editable hero stat overrides (display strings, e.g. "20+", "10k+").
   * When provided they are written to the clinic; when omitted the clinic page
   * falls back to its computed/default value.
   */
  stat_experts?: string | null;
  stat_cities?: string | null;
  stat_treatments?: string | null;
  stat_rating?: string | null;
  stat_patients?: string | null;
  /**
   * Optional admin overrides. When present they take precedence over the
   * auto-derive defaults:
   *  - treatment_slugs: ensure these canonical treatments are offered (matched,
   *    confidence 1), the same way the services PUT route does.
   *  - concern_slugs: persist the effective concern set via saveClinicConcerns
   *    relative to the derived set.
   * When absent, the existing auto-derive behaviour is kept (back-compat).
   */
  treatment_slugs?: string[];
  concern_slugs?: string[];
  /**
   * Optional G99 provenance. When importing from the G99 source DB, these stamp
   * the hard link used by the imported-status cross-reference and dedup the
   * business by g99_business_id.
   */
  g99_clinic_id?: string | number | null;
  g99_business_id?: string | number | null;
  g99_tenant_id?: string | number | null;
  /** Google Place ID carried over from G99 (clinics.google_place_id). */
  google_place_id?: string | null;
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

export interface ExistingClinicRef {
  id: string;
  name: string;
  slug: string;
  website: string | null;
}

/**
 * Like findClinicsByDomain but returns identifying details (name/slug/website)
 * for the duplicate-block UI, so the admin can jump straight to editing or
 * deleting the clinic that already occupies this domain.
 */
export async function findExistingClinicsByDomain(
  domain: string
): Promise<ExistingClinicRef[]> {
  return query<ExistingClinicRef>(
    `SELECT id, name, slug, website FROM clinics
      WHERE lower(regexp_replace(regexp_replace(website, '^https?://', ''), '^www\\.', '')) LIKE $1
      ORDER BY created_at`,
    [`${domain}%`]
  );
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

  // ── business (one per bundle) ──────────────────────────────────────────────
  // Dedup priority: G99 business id (hard link) → name.
  const g99BusinessId = payload.g99_business_id != null ? String(payload.g99_business_id) : null;
  const g99TenantId = payload.g99_tenant_id != null ? String(payload.g99_tenant_id) : null;
  let businessId: string;
  let businessCreated = false;
  const existingBiz = await queryOne<{ id: string }>(
    g99BusinessId
      ? `SELECT id FROM businesses WHERE g99_business_id = $1::bigint
         UNION ALL SELECT id FROM businesses WHERE name = $2 ORDER BY 1 LIMIT 1`
      : `SELECT id FROM businesses WHERE name = $1 ORDER BY created_at LIMIT 1`,
    g99BusinessId ? [g99BusinessId, bizName] : [bizName]
  );
  if (existingBiz) {
    businessId = existingBiz.id;
    if (g99BusinessId) {
      await query(
        `UPDATE businesses SET
            g99_business_id = COALESCE($2::bigint, g99_business_id),
            g99_tenant_id   = COALESCE($3::bigint, g99_tenant_id),
            last_synced_at  = NOW()
          WHERE id = $1`,
        [businessId, g99BusinessId, g99TenantId]
      );
    }
  } else {
    const ins = await queryOne<{ id: string }>(
      `INSERT INTO businesses (name, tier, verified, data_source, g99_business_id, g99_tenant_id, last_synced_at)
       VALUES ($1, 'free', false, 'scraped', $2::bigint, $3::bigint, NOW()) RETURNING id`,
      [bizName, g99BusinessId, g99TenantId]
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

  // ── One clinic per business (not one per location) ──────────────────────────
  const clinicName = bizName;
  const slugBase = slugify(clinicName);

  // Reuse existing clinic by domain, or create one.
  let clinicId: string | null = existingClinicIds[0] ?? null;
  let created = false;
  let slug = slugBase;

  const primaryLoc = payload.locations[0] ?? {};

  // Clinic-row field sources. In clinic-level mode (payload.clinic present) the
  // clinic-wide columns come from payload.clinic and the HEADLINE
  // address/city/state/zip/geo/hours/maps are left blank; otherwise everything
  // is derived from locations[0] (legacy admin/demo behaviour).
  const cl = payload.clinic;
  const clinicMode = cl != null;
  const cBookingUrl = clinicMode ? cl.booking_url ?? null : primaryLoc.booking_url ?? null;
  const cAbout = clinicMode ? cl.about ?? null : primaryLoc.about ?? null;
  const cTagline = clinicMode ? cl.tagline ?? null : primaryLoc.tagline ?? null;
  const cEmail = clinicMode ? cl.email ?? null : primaryLoc.email ?? null;
  const cPhone = clinicMode ? cl.phone ?? null : primaryLoc.phone ?? null;
  const cInstagram = clinicMode ? cl.instagram_url ?? null : primaryLoc.instagram_url ?? null;
  const cFacebook = clinicMode ? cl.facebook_url ?? null : primaryLoc.facebook_url ?? null;
  const cTiktok = clinicMode ? cl.tiktok_url ?? null : primaryLoc.tiktok_url ?? null;
  const cYoutube = clinicMode ? cl.youtube_url ?? null : primaryLoc.youtube_url ?? null;
  const cX = clinicMode ? cl.x_url ?? null : primaryLoc.x_url ?? null;
  const cLinkedin = clinicMode ? cl.linkedin_url ?? null : primaryLoc.linkedin_url ?? null;
  const cYelp = clinicMode ? cl.yelp_url ?? null : primaryLoc.yelp_url ?? null;
  const cGmb = clinicMode ? cl.google_my_business ?? null : primaryLoc.google_my_business ?? null;
  // Headline location fields — blank in clinic-level mode.
  const cAddress = clinicMode ? null : primaryLoc.address ?? null;
  const cCity = clinicMode ? null : primaryLoc.city ?? null;
  const cState = clinicMode ? null : primaryLoc.state ?? null;
  const cZip = clinicMode ? null : primaryLoc.zip ?? null;
  const cMapsUrl = clinicMode ? null : primaryLoc.maps_url ?? null;

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
        clinicId, clinicName, website,
        cBookingUrl, cAddress,
        cCity, cState, cZip,
        cPhone, cEmail, cAbout,
        cInstagram, cFacebook,
        cTiktok, cYoutube,
        cTagline, cMapsUrl,
        cX, cLinkedin,
        cYelp, cGmb,
      ]
    );
    const existing = await queryOne<{ slug: string }>(
      `SELECT slug FROM clinics WHERE id = $1`,
      [clinicId]
    );
    slug = existing?.slug ?? slugBase;
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
        businessId, clinicName, slug, website,
        cBookingUrl, cAddress,
        cCity, cState, cZip,
        cPhone, cEmail, cAbout,
        cInstagram, cFacebook,
        cTiktok, cYoutube,
        cTagline, cMapsUrl,
        cX, cLinkedin,
        cYelp, cGmb,
      ]
    );
    clinicId = ins!.id;
    created = true;
  }

  result.clinics.push({ id: clinicId, slug, created });

  // ── G99 link stamp (hard link + place id) ──────────────────────────────────
  const g99ClinicId = payload.g99_clinic_id != null ? String(payload.g99_clinic_id) : null;
  if (g99ClinicId || payload.google_place_id) {
    await query(
      `UPDATE clinics SET
          g99_clinic_id   = COALESCE($2::bigint, g99_clinic_id),
          google_place_id = COALESCE($3, google_place_id),
          last_synced_at  = NOW()
        WHERE id = $1`,
      [clinicId, g99ClinicId, payload.google_place_id ?? null]
    );
  }

  // geo + hours from primary location — legacy mode only. In clinic-level mode
  // the clinic row carries no headline geo/hours (all lives in clinic_locations).
  if (!clinicMode && primaryLoc.lat != null && primaryLoc.lng != null) {
    await query(
      `UPDATE clinics SET lat = $2::float8::numeric, lng = $3::float8::numeric,
          geo = ST_SetSRID(ST_MakePoint($3::float8, $2::float8), 4326)::geography,
          updated_at = NOW() WHERE id = $1`,
      [clinicId, primaryLoc.lat, primaryLoc.lng]
    );
  }
  if (!clinicMode && primaryLoc.hours) {
    await query(`UPDATE clinics SET hours = $2::jsonb WHERE id = $1`, [
      clinicId,
      JSON.stringify(primaryLoc.hours),
    ]);
  }
  if (payload.ext_rating != null) {
    await query(
      `UPDATE clinics SET ext_rating = $2, ext_review_count = $3 WHERE id = $1`,
      [clinicId, Math.min(5, Math.max(0, payload.ext_rating)), payload.ext_review_count ?? null]
    );
  }

  // hero stat overrides (display strings) — only fill the ones provided.
  const statFields = [
    payload.stat_experts,
    payload.stat_cities,
    payload.stat_treatments,
    payload.stat_rating,
    payload.stat_patients,
  ];
  if (statFields.some((v) => v !== undefined)) {
    const norm = (v: string | null | undefined) => {
      if (v === undefined) return undefined; // leave column untouched
      const t = (v ?? "").trim();
      return t.length > 0 ? t : null; // empty string clears the override
    };
    await query(
      `UPDATE clinics SET
          stat_experts    = COALESCE($2, stat_experts),
          stat_cities     = COALESCE($3, stat_cities),
          stat_treatments = COALESCE($4, stat_treatments),
          stat_rating     = COALESCE($5, stat_rating),
          stat_patients   = COALESCE($6, stat_patients),
          updated_at = NOW()
        WHERE id = $1`,
      [
        clinicId,
        norm(payload.stat_experts) ?? null,
        norm(payload.stat_cities) ?? null,
        norm(payload.stat_treatments) ?? null,
        norm(payload.stat_rating) ?? null,
        norm(payload.stat_patients) ?? null,
      ]
    );
  }

  // ── clinic_locations (one row per location) ───────────────────────────────
  if (overwrite) {
    await query(`DELETE FROM clinic_locations WHERE clinic_id = $1`, [clinicId]);
  }
  const locations = payload.locations.length > 0 ? payload.locations : [{}];
  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];
    // No primary in clinic-level mode; legacy callers keep locations[0] primary.
    const isPrimary = clinicMode ? false : i === 0;
    await query(
      `INSERT INTO clinic_locations
         (clinic_id, label, address, city, state, zip, phone, email,
          booking_url, google_maps_url, hours, lat, lng, is_primary, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15)
       ON CONFLICT DO NOTHING`,
      [
        clinicId,
        loc.city ?? (locations.length > 1 ? `Location ${i + 1}` : null),
        loc.address ?? null, loc.city ?? null, loc.state ?? null, loc.zip ?? null,
        loc.phone ?? null, loc.email ?? null,
        loc.booking_url ?? null, loc.maps_url ?? null,
        loc.hours ? JSON.stringify(loc.hours) : null,
        loc.lat ?? null, loc.lng ?? null,
        isPrimary, i,
      ]
    );
    // geo on the location row
    if (loc.lat != null && loc.lng != null) {
      try {
        await query(
          `UPDATE clinic_locations
              SET geo = ST_SetSRID(ST_MakePoint($2::float8, $1::float8), 4326)::geography
            WHERE clinic_id = $3 AND sort_order = $4 AND geo IS NULL`,
          [loc.lat, loc.lng, clinicId, i]
        );
      } catch { /* PostGIS unavailable */ }
    }
  }

  // ── services (NEVER skip; unmatched → service_id NULL) ───────────────────
  if (overwrite) {
    await query(`DELETE FROM clinic_services WHERE clinic_id = $1`, [clinicId]);
  }
  const seenRaw = new Set<string>();
  for (const s of payload.services) {
    const raw = s.raw_name?.trim();
    if (!raw) continue;
    if (s.ignored) continue;
    const rawKey = raw.toLowerCase();
    if (seenRaw.has(rawKey)) continue;
    seenRaw.add(rawKey);

    let serviceId: string | null = null;
    let confidence = 0;
    let matchStatus: "matched" | "auto" | "unmatched";

    if (s.mapped_slug) {
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
  for (const g of imgs?.gallery ?? []) {
    await insertImg(g, go === 0 ? "cover" : "gallery", go);
    go++;
  }
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

  // ── optional admin override: ensure canonical treatments are offered ──────
  // Mirrors the services PUT route: each requested canonical slug becomes a
  // matched clinic_services row (confidence 1, data_source 'manual').
  if (payload.treatment_slugs && payload.treatment_slugs.length > 0) {
    const wanted = [
      ...new Set(payload.treatment_slugs.filter((s) => PRIORITY_SERVICE_SLUG_SET.has(s))),
    ];
    if (wanted.length > 0) {
      const svcRows = await query<{ id: string; name: string; slug: string }>(
        `SELECT id, name, slug FROM services WHERE slug = ANY($1::text[]) AND is_active = true`,
        [wanted]
      );
      for (const svc of svcRows) {
        await query(
          `INSERT INTO clinic_services
             (clinic_id, service_id, raw_name, match_status, match_confidence, data_source, last_scraped_at, is_active)
           VALUES ($1, $2, $3, 'matched', 1, 'manual', NOW(), true)
           ON CONFLICT (clinic_id, raw_name) DO UPDATE SET
             service_id = EXCLUDED.service_id,
             match_status = 'matched',
             match_confidence = 1,
             data_source = 'manual',
             is_active = true,
             updated_at = NOW()`,
          [clinicId, svc.id, svc.name]
        );
      }
    }
  }

  // ── concern_services for this clinic's matched canonical services ────────
  result.concernLinks += await deriveConcernServicesForClinic(clinicId);

  // ── optional admin override: persist effective concern set ────────────────
  // When concern_slugs is provided, persist overrides relative to the derived
  // set (additions=manual, removals=removed, deactivate stale). Otherwise the
  // auto-derived membership above is the default.
  if (payload.concern_slugs) {
    await saveClinicConcerns(clinicId, payload.concern_slugs);
  }

  return result;
}

/**
 * Link concerns to the canonical services this clinic actually offers (matched
 * service_id), using the curated CANONICAL_CONCERNS.serviceSlugs map (exact
 * slug membership). Because the map is the same one that seeds the global
 * concern_services table, this can only ever re-affirm curated links — it can
 * never introduce a concern↔service pairing outside the Phase-0 mapping.
 * display_order follows the curated order so it stays stable across clinics.
 */
async function deriveConcernServicesForClinic(clinicId: string): Promise<number> {
  const svcRows = await query<{ id: string; slug: string }>(
    `SELECT DISTINCT s.id, s.slug
       FROM services s
       JOIN clinic_services cs ON cs.service_id = s.id
      WHERE cs.clinic_id = $1 AND s.is_active = true`,
    [clinicId]
  );
  if (svcRows.length === 0) return 0;

  const idBySlug = new Map(svcRows.map((s) => [s.slug, s.id]));
  let links = 0;
  for (const def of CANONICAL_CONCERNS) {
    const concern = await queryOne<{ id: string }>(
      `SELECT id FROM concerns WHERE slug = $1`,
      [def.slug]
    );
    if (!concern) continue;
    for (let i = 0; i < def.serviceSlugs.length; i++) {
      const serviceId = idBySlug.get(def.serviceSlugs[i]);
      if (!serviceId) continue;
      const res = await query<{ id: string }>(
        `INSERT INTO concern_services (concern_id, service_id, display_order)
         VALUES ($1,$2,$3) ON CONFLICT (concern_id, service_id) DO NOTHING RETURNING id`,
        [concern.id, serviceId, i]
      );
      links += res.length;
    }
  }
  return links;
}
