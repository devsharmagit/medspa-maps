/**
 * admin/clinic-save.ts — persist a save-ready clinic bundle.
 *
 * saveClinicBundle() takes the SAVE-READY payload produced by
 * scrapeClinicPreview() (or assembled in the admin UI) and writes:
 *   - ONE clinic row (business-less; g99_business_id/g99_tenant_id stamped
 *     directly on the clinic) keyed by website domain
 *   - clinic_locations (one row per payload.locations entry — all address/geo
 *     lives here; the clinic row carries no headline city/state/zip/geo)
 *   - clinic_services (each mapped via matchService → service_id/match_status;
 *     unmatched ones kept with service_id NULL)
 *   - images (logo / gallery / before_after — source_url only, entity_type='clinic')
 *   - reviews
 *   - providers
 *
 * Dedup / overwrite is keyed by WEBSITE DOMAIN: existing clinics whose website
 * resolves to the same hostname are reused. Pricing is skipped.
 *
 * Pure DB logic (no HTTP/auth). Mirrors the upsert patterns in
 * scripts/ingest-all.ts.
 */

import { createHash } from "node:crypto";
import { query, queryOne } from "@/lib/db";
import { slugify } from "@/lib/scraper/utils";
import {
  matchService,
  bestCatalogMatch,
  normalize,
  isServiceNoise,
  stripCredentials,
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
  /**
   * AI-proposed GENERAL treatment name (e.g. "Hormone Therapy" for a raw
   * "Bioidentical Hormone Replacement"). When the raw name doesn't resolve to an
   * existing catalog treatment, this is de-duped against the catalog and, if
   * still novel, created as a new `origin='ai'` service.
   */
  general_name?: string | null;
  /** AI-proposed category label for a newly-created general treatment. */
  general_category?: string | null;
  /**
   * AI public-surface decision:
   *  - public: general_name is allowed to become a public searchable service
   *  - alias_only: raw_name should only map to the generic/public service
   *  - ignored: skip entirely
   */
  public_decision?: "public" | "alias_only" | "ignored";
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
  hours?: Record<string, unknown> | null;
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

export interface SaveProvider {
  name: string;
  /** role / credentials label, e.g. "DNP, FNP-C", "Aesthetic Injector", "CEO, Medical Director, Founder" */
  title?: string | null;
  /** headshot URL (single column, not the polymorphic images table) */
  image_url?: string | null;
  /** short tagline — populated for the owner/CEO/founder only (also the owner-first sort key) */
  card_tagline?: string | null;
  is_verified?: boolean;
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
  /**
   * Treatments/services. OPTIONAL — omit entirely to leave this clinic's
   * existing clinic_services untouched (e.g. a details-only re-ingest via
   * ingestClinicByDomain, which no longer extracts services — see
   * ingest/ingest-services.ts). Pass an array (even []) when the caller
   * genuinely wants to overwrite the clinic's services with a fresh scrape.
   */
  services?: SaveService[];
  images?: SaveImages;
  /** Providers/practitioners (owner/CEO/founder first). Delete-then-insert on overwrite. */
  providers?: SaveProvider[];
  reviews?: SaveReview[];
  /** aggregate rating, if known */
  ext_rating?: number | null;
  ext_review_count?: number | null;
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
   * the hard link used by the imported-status cross-reference. They are written
   * directly onto the clinic row (no local business row exists any more).
   */
  g99_clinic_id?: string | number | null;
  g99_business_id?: string | number | null;
  g99_tenant_id?: string | number | null;
  /** Google Place ID carried over from G99 (clinics.google_place_id). */
  google_place_id?: string | null;
}

export interface SaveClinicResult {
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

/** Unique clinic slug — slug is now GLOBALLY unique on clinics (clinics_slug_key). */
async function uniqueClinicSlug(base: string): Promise<string> {
  let slug = base || "clinic";
  let n = 2;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM clinics WHERE slug = $1`,
      [slug]
    );
    if (!existing) return slug;
    slug = `${base}-${n++}`;
  }
}

export interface SaveServicesResult {
  matched: number;
  auto: number;
  unmatched: number;
}

/**
 * saveClinicServices(clinicId, services, opts) — resolve + persist ONE clinic's
 * treatment/service rows. Standalone and reusable: called by saveClinicBundle
 * (the heuristic-scraper / admin-save / rescrape path, as part of a full bundle
 * save) AND by ingestServicesByDomain (the AI treatments-only refresh path, see
 * ingest/ingest-services.ts) — both need IDENTICAL resolution logic so a clinic's
 * canonical mapping never depends on which caller touched it last.
 *
 * Resolution order per raw service: deterministic junk/staff-name backstop →
 * admin override (mapped_slug) → public AI decision (own row / curated 15+
 * aliases) → live DB catalog fuzzy → AI general_name fuzzy/create → unmatched
 * (still stored by raw_name).
 *
 * overwrite (default true): deletes this clinic's existing clinic_services
 * first, then re-inserts. When false, existing rows for OTHER raw_names are
 * left alone (the per-raw_name upsert still refreshes a matching raw_name).
 */
export async function saveClinicServices(
  clinicId: string,
  services: SaveService[],
  opts: { website?: string | null; providerNames?: string[]; overwrite?: boolean } = {}
): Promise<SaveServicesResult> {
  const overwrite = opts.overwrite ?? true;

  if (overwrite) {
    await query(`DELETE FROM clinic_services WHERE clinic_id = $1`, [clinicId]);
  }

  // Load the live catalog once (curated 15 + previously AI-grown rows).
  // The services catalog is now name/slug/origin only — no aliases column.
  type CatRow = { id: string; name: string; slug: string; aliases: string[]; origin: string };
  const catalog: CatRow[] = (
    await query<{ id: string; name: string; slug: string; origin: string | null }>(
      `SELECT id, name, slug, COALESCE(origin, 'seed') AS origin
         FROM services WHERE is_active = true`
    )
  ).map((r) => ({ id: r.id, name: r.name, slug: r.slug, aliases: [], origin: r.origin ?? "seed" }));
  const catBySlug = new Map(catalog.map((r) => [r.slug, r]));

  const cleanName = (v: string) => v.replace(/[®™©]/g, "").replace(/\s+/g, " ").trim();
  const uniqueServiceSlug = async (base: string): Promise<string> => {
    const root = base || "treatment";
    let slug = root;
    let n = 2;
    while (catBySlug.has(slug) || (await queryOne(`SELECT 1 FROM services WHERE slug = $1`, [slug]))) {
      slug = `${root}-${n++}`;
    }
    return slug;
  };
  const createAiService = async (generalName: string, rawName: string): Promise<CatRow> => {
    const name = cleanName(generalName) || cleanName(rawName);
    const slug = await uniqueServiceSlug(slugify(name));
    const ins = await queryOne<{ id: string }>(
      `INSERT INTO services (name, slug, origin, is_active)
       VALUES ($1,$2,'ai',true)
       ON CONFLICT (slug) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [name, slug]
    );
    const row: CatRow = { id: ins!.id, name, slug, aliases: [], origin: "ai" };
    catalog.push(row);
    catBySlug.set(slug, row);
    return row;
  };

  // Normalized names of this clinic's own providers — a scraped "service" that
  // is really a staff member (e.g. "Katie Stein, BSN", "Christina Fitch") must
  // never become a treatment. Credentials are stripped so "Mara Costa, APRN-BC"
  // matches the provider "Mara Costa".
  const providerNorms = new Set((opts.providerNames ?? []).map((n) => stripCredentials(n ?? "")).filter(Boolean));

  let matched = 0;
  let auto = 0;
  let unmatched = 0;
  const seenRaw = new Set<string>();
  for (const s of services) {
    const raw = s.raw_name?.trim();
    if (!raw) continue;
    if (s.ignored) continue;
    // Deterministic junk backstop: drop nav/CTA/footer/category-header/testing
    // junk and staff names even if the AI marked them public_decision='public'.
    // Not stored at all (no clinic_services row) — they are not offerings.
    if (isServiceNoise(raw) || providerNorms.has(stripCredentials(raw))) continue;
    const rawKey = raw.toLowerCase();
    if (seenRaw.has(rawKey)) continue;
    seenRaw.add(rawKey);

    let serviceId: string | null = null;
    let matchStatus: "matched" | "auto" | "unmatched" = "unmatched";

    const publicDecision = s.public_decision ?? "public";
    const exactNameMatch = (name: string): CatRow | undefined => {
      const n = normalize(name);
      return catalog.find((row) => normalize(row.name) === n);
    };
    const mapByGeneralName = async (forceCreatePublic: boolean) => {
      const gen = s.general_name?.trim();
      if (!gen || gen.length < 3) return false;
      const exact = exactNameMatch(gen);
      const row = exact
        ? exact
        : forceCreatePublic
          ? await createAiService(gen, raw)
          : (bestCatalogMatch(gen, catalog, 0.72)
              ? catBySlug.get(bestCatalogMatch(gen, catalog, 0.72)!.entry.slug)!
              : await createAiService(gen, raw));
      serviceId = row.id;
      matchStatus = exact ? "matched" : "auto";
      return true;
    };

    if (s.mapped_slug) {
      const svc = catBySlug.get(s.mapped_slug)
        ?? (await queryOne<{ id: string }>(`SELECT id FROM services WHERE slug = $1`, [s.mapped_slug]));
      serviceId = svc?.id ?? null;
      matchStatus = serviceId ? "matched" : "unmatched";
    } else if (publicDecision === "public" && await mapByGeneralName(true)) {
      // Public AI decision wins before the old alias matcher so real searchable
      // brands/devices (Dysport, Morpheus8, MiraDry) do not collapse into broad
      // buckets like Botox or Microneedling.
    } else {
      // 1. curated matcher — authoritative for the 15 + their brand aliases
      const curated = matchService(raw);
      const curatedRow = curated.slug ? catBySlug.get(curated.slug) : undefined;
      if (curatedRow) {
        serviceId = curatedRow.id;
        matchStatus = curated.confidence >= 1 ? "matched" : "auto";
      } else if (s.general_name && s.general_name.trim().length >= 3) {
        // 2. The AI's GENERIC treatment name is authoritative for the long tail:
        //    match it against the catalog (exact / ≥0.72) or create a new generic
        //    bucket. This runs BEFORE any raw-name fuzzy so distinct variants
        //    (Phentermine, Metformin, Semaglutide…) collapse into the clean
        //    generic bucket the AI chose ("Medical Weight Loss") — not a
        //    drug-named row that a raw fuzzy-match happened to land on.
        await mapByGeneralName(false);
      } else {
        // 3. no AI suggestion (heuristic-fallback path) → fuzzy the raw name
        //    against the live catalog; else leave unmatched (still stored by raw_name).
        const dbHit = bestCatalogMatch(raw, catalog);
        if (dbHit) {
          const row = catBySlug.get(dbHit.entry.slug)!;
          serviceId = row.id;
          matchStatus = dbHit.confidence >= 1 ? "matched" : "auto";
        } else {
          matchStatus = "unmatched";
        }
      }
    }
    if (matchStatus === "matched") matched++;
    else if (matchStatus === "auto") auto++;
    else unmatched++;

    await query(
      `INSERT INTO clinic_services
         (clinic_id, service_id, raw_name, description, match_status)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (clinic_id, raw_name) DO UPDATE SET
         service_id = EXCLUDED.service_id,
         description = COALESCE(EXCLUDED.description, clinic_services.description),
         match_status = EXCLUDED.match_status,
         updated_at = NOW()`,
      [clinicId, serviceId, raw, s.description ?? null, matchStatus]
    );
  }

  return { matched, auto, unmatched };
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

  // G99 provenance — stamped directly onto the clinic row (no local business).
  const g99BusinessId = payload.g99_business_id != null ? String(payload.g99_business_id) : null;
  const g99TenantId = payload.g99_tenant_id != null ? String(payload.g99_tenant_id) : null;

  // existing clinics for this domain (overwrite targets / dedup)
  const existingClinicIds = await findClinicsByDomain(domain);

  const result: SaveClinicResult = {
    clinics: [],
    servicesMatched: 0,
    servicesAuto: 0,
    servicesUnmatched: 0,
    images: 0,
    reviews: 0,
    concernLinks: 0,
  };

  const clinicName = bizName;
  const slugBase = slugify(clinicName);

  // Reuse existing clinic by domain, or create one.
  let clinicId: string | null = existingClinicIds[0] ?? null;
  let created = false;
  let slug = slugBase;

  const primaryLoc = payload.locations[0] ?? {};

  // Clinic-row field sources. In clinic-level mode (payload.clinic present) the
  // clinic-wide columns come from payload.clinic and the HEADLINE
  // address/hours/maps are left blank; otherwise everything is derived from
  // locations[0] (legacy admin/demo behaviour). City/state/zip/geo now live
  // ONLY on clinic_locations, never on the clinic row.
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
  // Headline address — blank in clinic-level mode.
  const cAddress = clinicMode ? null : primaryLoc.address ?? null;
  const cMapsUrl = clinicMode ? null : primaryLoc.maps_url ?? null;
  // Working hours: clinic-wide in clinic mode, else derived from primary loc.
  const cHours = clinicMode ? cl.hours ?? null : primaryLoc.hours ?? null;
  const cHoursJson = cHours ? JSON.stringify(cHours) : null;

  if (clinicId) {
    const setOrOverwrite = (col: string, idx: number) =>
      overwrite ? `${col} = $${idx}` : `${col} = COALESCE($${idx}, ${col})`;
    await query(
      `UPDATE clinics SET
          name = $2,
          website = $3,
          ${setOrOverwrite("booking_url", 4)},
          ${setOrOverwrite("address", 5)},
          ${setOrOverwrite("phone", 6)},
          ${setOrOverwrite("email", 7)},
          ${setOrOverwrite("about", 8)},
          ${setOrOverwrite("instagram_url", 9)},
          ${setOrOverwrite("facebook_url", 10)},
          ${setOrOverwrite("tiktok_url", 11)},
          ${setOrOverwrite("youtube_url", 12)},
          ${setOrOverwrite("tagline", 13)},
          ${setOrOverwrite("google_maps_url", 14)},
          ${setOrOverwrite("x_url", 15)},
          ${setOrOverwrite("linkedin_url", 16)},
          ${setOrOverwrite("yelp_url", 17)},
          ${setOrOverwrite("google_my_business", 18)},
          hours = ${overwrite ? "$19::jsonb" : "COALESCE($19::jsonb, hours)"},
          g99_business_id = COALESCE($20::bigint, g99_business_id),
          g99_tenant_id   = COALESCE($21::bigint, g99_tenant_id),
          data_source = 'scraped',
          last_scraped_at = NOW(),
          updated_at = NOW()
        WHERE id = $1`,
      [
        clinicId, clinicName, website,
        cBookingUrl, cAddress,
        cPhone, cEmail, cAbout,
        cInstagram, cFacebook,
        cTiktok, cYoutube,
        cTagline, cMapsUrl,
        cX, cLinkedin,
        cYelp, cGmb,
        cHoursJson,
        g99BusinessId, g99TenantId,
      ]
    );
    const existing = await queryOne<{ slug: string }>(
      `SELECT slug FROM clinics WHERE id = $1`,
      [clinicId]
    );
    slug = existing?.slug ?? slugBase;
  } else {
    slug = await uniqueClinicSlug(slugBase);
    const ins = await queryOne<{ id: string }>(
      `INSERT INTO clinics
         (name, slug, website, booking_url, address,
          phone, email, about, instagram_url, facebook_url, tiktok_url, youtube_url,
          tagline, google_maps_url, x_url, linkedin_url, yelp_url, google_my_business,
          hours, g99_business_id, g99_tenant_id, data_source, last_scraped_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20::bigint,$21::bigint,'scraped',NOW())
       RETURNING id`,
      [
        clinicName, slug, website,
        cBookingUrl, cAddress,
        cPhone, cEmail, cAbout,
        cInstagram, cFacebook,
        cTiktok, cYoutube,
        cTagline, cMapsUrl,
        cX, cLinkedin,
        cYelp, cGmb,
        cHoursJson,
        g99BusinessId, g99TenantId,
      ]
    );
    clinicId = ins!.id;
    created = true;
  }

  result.clinics.push({ id: clinicId, slug, created });

  // ── G99 clinic link stamp (hard link + place id) ────────────────────────────
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

  if (payload.ext_rating != null) {
    await query(
      `UPDATE clinics SET ext_rating = $2, ext_review_count = $3 WHERE id = $1`,
      [clinicId, Math.min(5, Math.max(0, payload.ext_rating)), payload.ext_review_count ?? null]
    );
  }

  // ── clinic_locations (one row per location; all address/geo lives here) ─────
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

  // ── services (skipped entirely when payload.services is omitted) ─────────
  // Delegates to the standalone saveClinicServices() (shared with the AI
  // treatments-only refresh, ingest/ingest-services.ts) so both callers resolve
  // a raw name to the exact same canonical row. `services` is OPTIONAL on the
  // bundle specifically so a details-only save (e.g. ingestClinicByDomain, which
  // no longer extracts services) can never wipe a clinic's existing treatments —
  // omit the field to leave clinic_services completely untouched.
  if (payload.services !== undefined) {
    const svcResult = await saveClinicServices(clinicId, payload.services, {
      website,
      providerNames: (payload.providers ?? []).map((p) => p.name),
      overwrite,
    });
    result.servicesMatched += svcResult.matched;
    result.servicesAuto += svcResult.auto;
    result.servicesUnmatched += svcResult.unmatched;
  }

  // ── images (logo / gallery / before_after; source_url only) ──────────────
  // On overwrite, clear previously-scraped image rows first so roles can change
  // on re-ingest (e.g. a URL promoted gallery→cover). Curated rows (CDN'd or
  // storage-backed) are preserved — mirrors the rescrape image guard.
  if (overwrite) {
    await query(
      `DELETE FROM images
         WHERE entity_type = 'clinic' AND entity_id = $1
           AND role IN ('cover','gallery','before_after','logo')
           AND cdn_url IS NULL AND storage_key IS NULL`,
      [clinicId]
    );
  }
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

  // ── providers (owner/CEO/founder first; delete-then-insert on overwrite) ────
  if (overwrite) {
    await query(`DELETE FROM providers WHERE clinic_id = $1`, [clinicId]);
  }
  for (const p of payload.providers ?? []) {
    const nm = p.name?.trim();
    if (!nm) continue;
    await query(
      `INSERT INTO providers (clinic_id, name, title, image_url, card_tagline, is_verified, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,true)`,
      [clinicId, nm, p.title ?? null, p.image_url ?? null, p.card_tagline ?? null, p.is_verified ?? false]
    );
  }

  // ── optional admin override: ensure canonical treatments are offered ──────
  // Mirrors the services PUT route: each requested canonical slug becomes a
  // matched clinic_services row.
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
             (clinic_id, service_id, raw_name, match_status, is_active)
           VALUES ($1, $2, $3, 'matched', true)
           ON CONFLICT (clinic_id, raw_name) DO UPDATE SET
             service_id = EXCLUDED.service_id,
             match_status = 'matched',
             is_active = true,
             updated_at = NOW()`,
          [clinicId, svc.id, svc.name]
        );
      }
    }
  }

  // ── optional admin override: persist effective concern set ────────────────
  // When concern_slugs is provided, persist overrides via saveClinicConcerns.
  if (payload.concern_slugs) {
    await saveClinicConcerns(clinicId, payload.concern_slugs);
  }

  return result;
}
