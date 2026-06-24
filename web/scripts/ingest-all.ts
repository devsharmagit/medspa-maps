/**
 * ingest-all.ts — run with: bun scripts/ingest-all.ts
 *
 * Re-ingests the 5 sample sites into a freshly-reset DB, mapping every scraped
 * service onto the canonical taxonomy (src/lib/taxonomy/canonical.ts).
 *
 * For EACH site it:
 *   1. scrapeWebsite(url) → contact, locations[], services, images.
 *   2. Upserts ONE business; then for EACH location in locations[] upserts a
 *      clinic (multi-location → multiple clinics, same business, distinct
 *      address/slug/geo). Single location → one clinic.
 *   3. Services: merges scrapeWebsite services + extractServiceAnchors(homepage
 *      + /services/), and for each calls matchService(rawName) to set
 *      clinic_services.{raw_name, service_id, match_status, match_confidence}.
 *      NEVER skips a service — unmatched ones get service_id NULL +
 *      match_status 'unmatched'.
 *   4. Reviews: extractReviews on /reviews/ (+ aggregate → ext_rating/
 *      ext_review_count). before/after: extractBeforeAfter on gallery pages →
 *      images role='before_after'. Clinic gallery images too.
 *   5. Derives concern_services from CANONICAL_CONCERNS.serviceKeywords against
 *      the clinic's matched canonical services.
 *
 * Providers and pricing are skipped entirely.
 *
 * Mirrors the conventions of scripts/ingest-sites.ts and scripts/enrich-clinic.ts.
 * Idempotent: safe to re-run (upserts on natural keys).
 */

import { scrapeWebsite } from "../src/lib/scraper";
import { fetchHtml, load, slugify } from "../src/lib/scraper/utils";
import { extractReviews, type ScrapedReview } from "../src/lib/scraper/reviews";
import { extractBeforeAfter } from "../src/lib/scraper/beforeafter";
import { extractServiceAnchors } from "../src/lib/scraper/services";
import type {
  ScrapedImage,
  ScrapedService,
  ScrapedLocation,
} from "../src/lib/scraper/types";
import { CANONICAL_CONCERNS, matchService } from "../src/lib/taxonomy/canonical";
import pool from "../src/lib/db";
import { createHash } from "node:crypto";

const SITES = [
  "https://ruma.com",
  "https://gloderma.com",
  "https://gfacemd.com",
  "https://trubeautybytrevor.com",
  "https://beautylablaser.com",
];

const q = (sql: string, params?: unknown[]) => pool.query(sql, params);
const hash = (s: string) => createHash("sha1").update(s).digest("hex");

interface ClinicReport {
  name: string;
  servicesMatched: number;
  servicesAuto: number;
  servicesUnmatched: number;
  reviews: number;
  beforeAfter: number;
}

interface SiteReport {
  domain: string;
  business: string;
  clinics: number;
  matched: number;
  auto: number;
  unmatched: number;
  reviews: number;
  beforeAfter: number;
  clinicIds: string[];
}

/**
 * Best-effort city/town token from a scraped address. The locations parser
 * appends the city to the end of the street line (e.g. "25 Walnut St Suite
 * 101Wellesley", "5496 S 900 East Murray"), so grab the trailing capitalized
 * word(s) with no digits — used only as a discriminator for multi-location
 * clinics that lack a parsed city.
 */
function locationToken(address: string | undefined): string | null {
  if (!address) return null;
  const m = address.match(/([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)\s*$/);
  return m ? m[1].trim() : null;
}

/** Ensure a clinic slug is unique within its business (the natural key). */
async function uniqueClinicSlug(base: string, businessId: string): Promise<string> {
  let slug = base || "clinic";
  let n = 2;
  while (true) {
    const { rows } = await q(
      `SELECT 1 FROM clinics WHERE business_id=$1 AND slug=$2`,
      [businessId, slug]
    );
    if (rows.length === 0) return slug;
    slug = `${base}-${n++}`;
  }
}

/**
 * Build the merged, cleaned service list for a site: scrapeWebsite services +
 * anchor services from the homepage and /services/. Dedupe by slug; drop nav /
 * CTA / category noise (mirrors the filtering in ingest-sites.ts).
 */
async function buildServiceList(
  siteUrl: string,
  scraped: ScrapedService[],
  bizName: string,
  domain: string
): Promise<ScrapedService[]> {
  const anchorServices: ScrapedService[] = [];
  const anchorPages = [siteUrl, `${siteUrl}/services/`];
  for (const pageUrl of anchorPages) {
    const r = await fetchHtml(pageUrl);
    if (!r) continue;
    anchorServices.push(...extractServiceAnchors(load(r.html), siteUrl));
  }

  const bizLower = bizName.toLowerCase();
  const merged: ScrapedService[] = [];
  const seen = new Set<string>();
  for (const s of [...scraped, ...anchorServices]) {
    const name = s.name?.trim();
    if (!name || !s.slug || seen.has(s.slug)) continue;
    if (name.length < 3 || name.length > 80) continue;
    if (s.is_category) continue;
    const lower = name.toLowerCase();
    if (lower === bizLower || lower === domain) continue;
    if (/^(ready to|let us|other services|menu|home|contact|about)/i.test(name)) continue;
    if (/^(peels|injectables|wellness|skincare|results|specials)$/i.test(name)) continue;
    seen.add(s.slug);
    merged.push(s);
  }
  return merged;
}

async function ingestSite(siteUrl: string): Promise<SiteReport | null> {
  const domain = new URL(siteUrl).hostname.replace(/^www\./, "");
  console.log(`\n🕷  Ingesting ${domain} ...`);

  const scrape = await scrapeWebsite(siteUrl);
  const c = scrape.contact;
  const bizName = c.name || domain;

  // ── business (one per site; dedupe by name) ───────────────────────────────
  let businessId: string;
  const existingBiz = await q(
    `SELECT id FROM businesses WHERE name=$1 ORDER BY created_at LIMIT 1`,
    [bizName]
  );
  if (existingBiz.rows.length > 0) {
    businessId = existingBiz.rows[0].id;
  } else {
    const ins = await q(
      `INSERT INTO businesses (name, tier, verified, data_source, last_synced_at)
       VALUES ($1, 'free', false, 'scraped', NOW()) RETURNING id`,
      [bizName]
    );
    businessId = ins.rows[0].id;
  }

  // ── logo (business-level brand image; used as clinic logo) ────────────────
  const logoImg = scrape.images.find((i) => i.role === "logo");

  // ── services (merged + cleaned) ────────────────────────────────────────────
  const services = await buildServiceList(siteUrl, scrape.services, bizName, domain);

  // ── reviews + aggregate (site-level; reused across this site's clinics) ────
  let allReviews: ScrapedReview[] = [];
  let aggregate: { rating: number; count: number | null } | undefined;
  for (const path of ["/reviews/"]) {
    const r = await fetchHtml(siteUrl + path);
    if (!r) continue;
    const ext = extractReviews(load(r.html), siteUrl + path);
    allReviews = allReviews.concat(ext.reviews);
    if (ext.aggregate && !aggregate) aggregate = ext.aggregate;
  }

  // ── before/after images (site-level gallery pages) ─────────────────────────
  const baImages: ScrapedImage[] = [];
  const baSeen = new Set<string>();
  const baPaths = [
    "/before-and-after-treatment-images/",
    "/before-and-after/",
    "/before-after/",
    "/gallery/",
    "/reviews/",
  ];
  for (const path of baPaths) {
    const r = await fetchHtml(siteUrl + path);
    if (!r) continue;
    for (const img of extractBeforeAfter(load(r.html), siteUrl + path)) {
      if (baSeen.has(img.source_url)) continue;
      baSeen.add(img.source_url);
      baImages.push(img);
    }
  }

  // ── clinic gallery images (homepage scrape) ────────────────────────────────
  const galleryImages = scrape.images.filter(
    (i) => i.role === "gallery" || i.role === "cover"
  );

  // ── one clinic per detected location ───────────────────────────────────────
  const locations: ScrapedLocation[] =
    scrape.locations.length > 0 ? scrape.locations : [{}];

  const report: SiteReport = {
    domain,
    business: bizName,
    clinics: 0,
    matched: 0,
    auto: 0,
    unmatched: 0,
    reviews: 0,
    beforeAfter: 0,
    clinicIds: [],
  };

  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i];
    // Per-location discriminator: prefer city, else the trailing city/town token
    // the locations parser appends to the address, else a 1-based index. This
    // keeps multi-location clinics (same business) on DISTINCT slugs.
    const locDiscriminator =
      loc.city ??
      c.city ??
      (locations.length > 1 ? locationToken(loc.address) ?? `Location ${i + 1}` : null);
    const clinicName = locDiscriminator
      ? `${bizName} – ${locDiscriminator}`
      : bizName;

    // locate by exact (business_id, slug) so each physical location is its own row
    const slugBase = slugify(clinicName);
    let clinicId: string;
    const existingRows = (
      await q(`SELECT id FROM clinics WHERE business_id=$1 AND slug=$2 LIMIT 1`, [
        businessId,
        slugBase,
      ])
    ).rows;
    // If the matched row was already claimed by an earlier location in THIS run
    // (two locations collapsed to the same discriminator), treat as a new row so
    // distinct physical locations never overwrite each other.
    const existing = {
      rows:
        existingRows.length > 0 && report.clinicIds.includes(existingRows[0].id)
          ? []
          : existingRows,
    };
    const phone = loc.phone ?? c.phone ?? null;
    const address = loc.address ?? c.address ?? null;
    const city = loc.city ?? c.city ?? null;
    const state = loc.state ?? c.state ?? null;
    const zip = loc.zip ?? c.zip ?? null;
    const lat = loc.lat ?? c.lat ?? null;
    const lng = loc.lng ?? c.lng ?? null;

    if (existing.rows.length > 0) {
      clinicId = existing.rows[0].id;
      await q(
        `UPDATE clinics SET name=$2, website=$3, booking_url=COALESCE($4,booking_url),
           address=COALESCE($5,address), city=COALESCE($6,city), state=COALESCE($7,state),
           zip=COALESCE($8,zip), phone=COALESCE($9,phone), email=COALESCE($10,email),
           about=COALESCE($11,about), instagram_url=COALESCE($12,instagram_url),
           facebook_url=COALESCE($13,facebook_url), tiktok_url=COALESCE($14,tiktok_url),
           youtube_url=COALESCE($15,youtube_url),
           data_source='scraped', last_scraped_at=NOW() WHERE id=$1`,
        [clinicId, clinicName, siteUrl, c.booking_url ?? null, address, city, state, zip,
         phone, c.email ?? null, c.about ?? null, c.instagram_url ?? null,
         c.facebook_url ?? null, c.tiktok_url ?? null, c.youtube_url ?? null]
      );
    } else {
      const slug = await uniqueClinicSlug(slugBase, businessId);
      const ins = await q(
        `INSERT INTO clinics (business_id, name, slug, website, booking_url, address,
           city, state, zip, phone, email, about, instagram_url, facebook_url,
           tiktok_url, youtube_url, data_source, verified, last_scraped_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'scraped',false,NOW())
         RETURNING id`,
        [businessId, clinicName, slug, siteUrl, c.booking_url ?? null, address, city,
         state, zip, phone, c.email ?? null, c.about ?? null, c.instagram_url ?? null,
         c.facebook_url ?? null, c.tiktok_url ?? null, c.youtube_url ?? null]
      );
      clinicId = ins.rows[0].id;
    }

    // lat/lng + PostGIS geo (when available from the scrape)
    if (lat != null && lng != null) {
      await q(
        `UPDATE clinics SET lat=$2::float8::numeric, lng=$3::float8::numeric,
           geo=ST_SetSRID(ST_MakePoint($3::float8, $2::float8), 4326)::geography,
           updated_at=NOW() WHERE id=$1`,
        [clinicId, lat, lng]
      );
    }

    // hours (from scraped contact or this location)
    const hours = loc.hours ?? c.hours;
    if (hours) {
      await q(`UPDATE clinics SET hours=$2::jsonb WHERE id=$1`, [
        clinicId,
        JSON.stringify(hours),
      ]);
    }

    report.clinics++;
    report.clinicIds.push(clinicId);
    console.log(`  business=${businessId.slice(0, 8)} clinic=${clinicId.slice(0, 8)} "${clinicName}"`);

    // ── services → canonical mapping (NEVER skip; unmatched → NULL) ──────────
    await q(`DELETE FROM clinic_services WHERE clinic_id=$1`, [clinicId]);
    let mC = 0, aC = 0, uC = 0;
    const seenRaw = new Set<string>();
    for (const s of services) {
      const raw = s.name.trim();
      const rawKey = raw.toLowerCase();
      if (seenRaw.has(rawKey)) continue;
      seenRaw.add(rawKey);

      const { slug: canonSlug, confidence } = matchService(raw);
      let serviceId: string | null = null;
      let matchStatus: "matched" | "auto" | "unmatched";
      if (canonSlug) {
        const svc = await q(`SELECT id FROM services WHERE slug=$1 LIMIT 1`, [canonSlug]);
        serviceId = svc.rows[0]?.id ?? null;
        matchStatus = serviceId ? (confidence >= 1 ? "matched" : "auto") : "unmatched";
      } else {
        matchStatus = "unmatched";
      }
      if (matchStatus === "matched") mC++;
      else if (matchStatus === "auto") aC++;
      else uC++;

      await q(
        `INSERT INTO clinic_services
           (clinic_id, service_id, raw_name, description, match_status, match_confidence,
            data_source, scraped_from_url, last_scraped_at)
         VALUES ($1,$2,$3,$4,$5,$6,'scraped',$7,NOW())
         ON CONFLICT (clinic_id, raw_name) DO UPDATE SET
           service_id=EXCLUDED.service_id,
           description=COALESCE(EXCLUDED.description, clinic_services.description),
           match_status=EXCLUDED.match_status,
           match_confidence=EXCLUDED.match_confidence,
           last_scraped_at=NOW()`,
        [clinicId, serviceId, raw, s.description ?? null, matchStatus,
         confidence || null, s.scraped_from_url ?? siteUrl]
      );
    }
    report.matched += mC;
    report.auto += aC;
    report.unmatched += uC;
    console.log(`  services: matched=${mC} auto=${aC} unmatched=${uC}`);

    // ── logo + gallery + before/after images (clinic-scoped) ────────────────
    const insertImg = async (img: ScrapedImage, role: string, order: number) => {
      if (!img.source_url) return;
      await q(
        `INSERT INTO images (entity_type, entity_id, source_url, role, sort_order, alt_text, scraped_domain, scrape_status)
         VALUES ('clinic',$1,$2,$3,$4,$5,$6,'ok')
         ON CONFLICT (entity_type, entity_id, source_url) DO NOTHING`,
        [clinicId, img.source_url, role, order, img.alt_text ?? null, domain]
      );
    };
    if (logoImg) await insertImg(logoImg, "logo", 0);
    let go = 0;
    for (const img of galleryImages) await insertImg(img, "gallery", go++);
    let bo = 0;
    for (const img of baImages) {
      await insertImg(img, "before_after", bo++);
    }
    report.beforeAfter += baImages.length;

    // ── reviews ─────────────────────────────────────────────────────────────
    let revCount = 0;
    for (const rev of allReviews) {
      const ch = hash(domain + "|" + clinicId.slice(0, 8) + "|" + rev.body.slice(0, 120));
      const res = await q(
        `INSERT INTO reviews (clinic_id, rating, body, reviewer_name, source, source_url, content_hash, data_source)
         VALUES ($1,$2,$3,$4,'scraped',$5,$6,'scraped')
         ON CONFLICT (content_hash) DO NOTHING RETURNING id`,
        [clinicId, rev.rating ?? null, rev.body, rev.reviewer_name ?? null, rev.source_url ?? null, ch]
      );
      if (res.rows.length) revCount++;
    }
    report.reviews += revCount;

    // aggregate rating → ext_rating / ext_review_count (these columns exist)
    if (aggregate) {
      await q(
        `UPDATE clinics SET ext_rating=$2, ext_review_count=$3 WHERE id=$1`,
        [clinicId, Math.min(5, Math.max(0, aggregate.rating)), aggregate.count ?? null]
      );
    }
    console.log(`  reviews: ${revCount}${aggregate ? ` (aggregate ${aggregate.rating}/${aggregate.count})` : ""} | before/after: ${baImages.length}`);
  }

  return report;
}

/**
 * Derive concern_services from CANONICAL_CONCERNS.serviceKeywords against the
 * canonical services actually matched by the ingested clinics (mirrors the
 * existing approach in ingest-sites.ts — keyword include on the service name).
 */
async function deriveConcernServices(): Promise<number> {
  await q(`DELETE FROM concern_services`);

  // canonical services in use (linked from any clinic via a matched service_id)
  const { rows: svcRows } = await q(
    `SELECT DISTINCT s.id, s.name
       FROM services s
       JOIN clinic_services cs ON cs.service_id = s.id
      WHERE s.is_active = true`
  );

  let links = 0;
  for (const def of CANONICAL_CONCERNS) {
    const { rows: cRows } = await q(`SELECT id FROM concerns WHERE slug=$1 LIMIT 1`, [def.slug]);
    if (cRows.length === 0) continue;
    const concernId = cRows[0].id;
    let order = 0;
    for (const svc of svcRows) {
      const nm = String(svc.name).toLowerCase();
      const included = def.serviceKeywords.some((k) => nm.includes(k.toLowerCase()));
      if (!included) continue;
      const res = await q(
        `INSERT INTO concern_services (concern_id, service_id, display_order)
         VALUES ($1,$2,$3) ON CONFLICT (concern_id, service_id) DO NOTHING RETURNING id`,
        [concernId, svc.id, order++]
      );
      if (res.rows.length) links++;
    }
  }
  return links;
}

async function main() {
  const reports: SiteReport[] = [];
  for (const site of SITES) {
    try {
      const r = await ingestSite(site);
      if (r) reports.push(r);
    } catch (e) {
      console.error(`❌ failed ingesting ${site}:`, (e as Error).message);
    }
  }

  console.log(`\n🧠 Deriving concern_services from matched canonical services...`);
  const links = await deriveConcernServices();
  console.log(`  concern_services links: ${links}`);

  // ── refresh search view ─────────────────────────────────────────────────
  try {
    await q(`REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view`);
    console.log(`🔄 clinic_search_view refreshed`);
  } catch {
    try {
      await q(`REFRESH MATERIALIZED VIEW clinic_search_view`);
      console.log(`🔄 clinic_search_view refreshed (non-concurrent)`);
    } catch (e2) {
      console.warn(`  ⚠ could not refresh view:`, (e2 as Error).message);
    }
  }

  // ── global admin-queue size: distinct unmatched raw_names ─────────────────
  const { rows: queueRows } = await q(
    `SELECT COUNT(DISTINCT raw_name)::int AS n
       FROM clinic_services WHERE match_status='unmatched'`
  );
  const queueSize = queueRows[0].n;

  // ── per-site report ───────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(70)}\n📋 PER-SITE REPORT\n${"=".repeat(70)}`);
  for (const r of reports) {
    const svcTotal = r.matched + r.auto + r.unmatched;
    console.log(`\n${r.domain}  (${r.business})`);
    console.log(`  clinics:       ${r.clinics}`);
    console.log(`  services:      ${svcTotal}  (matched ${r.matched} / auto ${r.auto} / unmatched ${r.unmatched})`);
    console.log(`  reviews:       ${r.reviews}`);
    console.log(`  before/after:  ${r.beforeAfter}`);
  }
  console.log(`\n${"=".repeat(70)}`);
  console.log(`🗂  GLOBAL admin queue (distinct unmatched raw_names): ${queueSize}`);
  console.log(`${"=".repeat(70)}\n`);

  // emit a machine-readable summary for the orchestrator
  console.log("JSON_REPORT_START");
  console.log(JSON.stringify({ sites: reports.map((r) => ({
    domain: r.domain, business: r.business, clinics: r.clinics,
    services: { matched: r.matched, auto: r.auto, unmatched: r.unmatched,
      total: r.matched + r.auto + r.unmatched },
    reviews: r.reviews, beforeAfter: r.beforeAfter,
  })), adminQueueSize: queueSize }, null, 2));
  console.log("JSON_REPORT_END");

  await pool.end();
}

main().catch((e) => {
  console.error("❌ ingest-all failed:", e);
  process.exit(1);
});
