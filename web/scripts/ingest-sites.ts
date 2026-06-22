/**
 * ingest-sites.ts — run with: bun scripts/ingest-sites.ts
 *
 * End-to-end ingest for the concern/service pages feature.
 *
 * For each source site (aamedspas.com, ruma.com) it:
 *   1. Scrapes the site (business, clinic, services, images, contact).
 *   2. Scrapes the /reviews/ page (JSON-LD + DOM testimonials).
 *   3. Scrapes before/after gallery images.
 *   4. Upserts business + clinic + clinic_services + canonical services + images.
 *   5. Inserts reviews (clinic-level) — rating roll-up handled by trigger.
 *
 * Then, across the union of all scraped services, it:
 *   6. Derives concerns (catalog entries with scraped evidence).
 *   7. Links concern_services and attaches before/after images to concerns.
 *
 * Idempotent: safe to re-run (upserts on natural keys).
 */

import { scrapeWebsite } from "../src/lib/scraper";
import { fetchHtml, load, slugify } from "../src/lib/scraper/utils";
import { extractReviews, type ScrapedReview } from "../src/lib/scraper/reviews";
import { extractBeforeAfter } from "../src/lib/scraper/beforeafter";
import { extractServiceAnchors } from "../src/lib/scraper/services";
import type { ScrapedImage, ScrapedService } from "../src/lib/scraper/types";
import { CONCERN_CATALOG } from "../src/lib/concerns/catalog";
import pool from "../src/lib/db";
import { createHash } from "node:crypto";

interface SiteCfg {
  url: string;
  reviewPaths: string[];
  baPaths: string[];
  /** extra pages to harvest the full service catalogue from (nav anchors) */
  extraServicePaths?: string[];
  /** clean display name override (fixes acronym casing the scraper mangles) */
  nameOverride?: string;
  /** booking URL when the scraper can't find one */
  bookingUrl?: string;
}

const SITES: SiteCfg[] = [
  {
    url: "https://aamedspas.com",
    reviewPaths: ["/reviews/"],
    baPaths: ["/reviews/"],
    bookingUrl: "https://angelaesthetics.myaestheticrecord.com/online-booking",
  },
  {
    url: "https://ruma.com",
    reviewPaths: ["/reviews/"],
    baPaths: ["/before-and-after-treatment-images/"],
    extraServicePaths: ["/services/", "/injections/", "/infusions/"],
    nameOverride: "RUMA Medical",
  },
];

const q = (sql: string, params?: unknown[]) => pool.query(sql, params);
const hash = (s: string) => createHash("sha1").update(s).digest("hex");

interface SiteIngest {
  domain: string;
  clinicId: string;
  serviceCorpus: string; // lowercased names+descriptions+text for concern derivation
}

async function uniqueClinicSlug(base: string): Promise<string> {
  let slug = base || "clinic";
  let n = 2;
  while (true) {
    const { rows } = await q(`SELECT 1 FROM clinics WHERE slug=$1`, [slug]);
    if (rows.length === 0) return slug;
    slug = `${base}-${n++}`;
  }
}

async function ingestSite(site: SiteCfg): Promise<SiteIngest | null> {
  const domain = new URL(site.url).hostname.replace(/^www\./, "");
  console.log(`\n🕷  Ingesting ${domain} ...`);

  const scrape = await scrapeWebsite(site.url);
  const c = scrape.contact;
  const bizName = site.nameOverride || c.name || domain;

  // ── harvest the full service catalogue from nav anchors ──────────────────
  // (the base scraper's URL-pattern nav extraction misses mega-menu catalogues)
  const anchorServices: ScrapedService[] = [];
  const anchorPages = [site.url, ...(site.extraServicePaths ?? []).map((p) => site.url + p)];
  for (const pageUrl of anchorPages) {
    const r = await fetchHtml(pageUrl);
    if (!r) continue;
    anchorServices.push(...extractServiceAnchors(load(r.html), site.url));
  }
  // merge scraped + anchor services, dedupe by slug
  const mergedServices: ScrapedService[] = [];
  const svcSeen = new Set<string>();
  for (const s of [...scrape.services, ...anchorServices]) {
    if (!s.slug || svcSeen.has(s.slug)) continue;
    svcSeen.add(s.slug);
    mergedServices.push(s);
  }

  // ── business (dedupe by name among scraped) ──────────────────────────────
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

  // ── clinic (upsert by website) ───────────────────────────────────────────
  const loc = scrape.locations[0] ?? {};
  // The locations scraper sometimes returns stray text ("Location",
  // "monika_29_may") as the name — fall back to the business name in that case.
  // loc.name from the scraper is unreliable for these sites ("Location:",
  // stray image alts) — derive a clean clinic name from the business + city.
  const clinicCity = loc.city ?? c.city;
  const clinicName = clinicCity ? `${bizName} – ${clinicCity}` : bizName;
  let clinicId: string;
  const existingClinic = await q(`SELECT id, slug FROM clinics WHERE website=$1 LIMIT 1`, [
    site.url,
  ]);
  if (existingClinic.rows.length > 0) {
    clinicId = existingClinic.rows[0].id;
    await q(`UPDATE clinics SET name=$2 WHERE id=$1`, [clinicId, clinicName]);
    await q(
      `UPDATE clinics SET city=COALESCE($2,city), state=COALESCE($3,state),
         phone=COALESCE($4,phone), address=COALESCE($5,address),
         booking_url=COALESCE($6,booking_url), about=COALESCE($7,about),
         data_source='scraped', last_scraped_at=NOW() WHERE id=$1`,
      [clinicId, loc.city ?? c.city, loc.state ?? c.state, loc.phone ?? c.phone,
       loc.address ?? c.address, c.booking_url ?? site.bookingUrl ?? null, c.about]
    );
  } else {
    const slug = await uniqueClinicSlug(slugify(clinicName));
    const ins = await q(
      `INSERT INTO clinics (business_id, name, slug, website, booking_url, address,
         city, state, zip, phone, email, about, instagram_url, facebook_url,
         data_source, verified, last_scraped_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'scraped',false,NOW())
       RETURNING id`,
      [businessId, clinicName, slug, site.url, c.booking_url ?? site.bookingUrl ?? null,
       loc.address ?? c.address ?? null, loc.city ?? c.city ?? null,
       loc.state ?? c.state ?? null, loc.zip ?? c.zip ?? null,
       loc.phone ?? c.phone ?? null, c.email ?? null, c.about ?? null,
       c.instagram_url ?? null, c.facebook_url ?? null]
    );
    clinicId = ins.rows[0].id;
  }
  console.log(`  business=${businessId.slice(0, 8)} clinic=${clinicId.slice(0, 8)}`);

  // ── services → canonical services + clinic_services ──────────────────────
  // Rebuild this clinic's offerings from scratch so removed/renamed/junk
  // services from earlier runs don't linger.
  await q(`DELETE FROM clinic_services WHERE clinic_id=$1`, [clinicId]);
  const corpusParts: string[] = [];
  let svcCount = 0;
  const bizLower = bizName.toLowerCase();
  for (const s of mergedServices) {
    const name = s.name?.trim();
    if (!name || name.length < 3 || name.length > 80) continue;
    if (s.is_category) continue;
    // skip the business name / domain harvested as a service
    if (name.toLowerCase() === bizLower || name.toLowerCase() === domain) continue;
    // drop CTA/nav noise (prefix) and bare category labels (exact)
    if (/^(ready to|let us|other services|menu|home|contact|about)/i.test(name)) continue;
    if (/^(peels|injectables|wellness|skincare|results|specials)$/i.test(name)) continue;
    const slug = slugify(name);
    if (!slug) continue;
    corpusParts.push(name.toLowerCase(), (s.description ?? "").toLowerCase());

    // canonical service
    const svc = await q(
      `INSERT INTO services (name, slug, category) VALUES ($1,$2,$3)
       ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
      [name, slug, s.category ?? null]
    );
    const serviceId = svc.rows[0].id;

    await q(
      `INSERT INTO clinic_services (clinic_id, service_id, raw_name, description, data_source, scraped_from_url, last_scraped_at)
       VALUES ($1,$2,$3,$4,'scraped',$5,NOW())
       ON CONFLICT (clinic_id, raw_name) DO UPDATE
         SET service_id=EXCLUDED.service_id, description=COALESCE(EXCLUDED.description, clinic_services.description), last_scraped_at=NOW()`,
      [clinicId, serviceId, name, s.description ?? null, s.scraped_from_url ?? site.url]
    );
    svcCount++;
  }
  console.log(`  services: ${svcCount}`);

  // ── clinic images ────────────────────────────────────────────────────────
  let imgCount = 0;
  for (const img of scrape.images) {
    if (!img.source_url) continue;
    await q(
      `INSERT INTO images (entity_type, entity_id, source_url, role, sort_order, alt_text, scraped_domain, scrape_status)
       VALUES ('clinic',$1,$2,$3,$4,$5,$6,'ok')
       ON CONFLICT (entity_type, entity_id, source_url) DO NOTHING`,
      [clinicId, img.source_url, img.role ?? "gallery", img.sort_order ?? 0, img.alt_text ?? null, domain]
    );
    imgCount++;
  }
  console.log(`  clinic images: ${imgCount}`);

  // ── reviews ───────────────────────────────────────────────────────────────
  let allReviews: ScrapedReview[] = [];
  let aggregate: { rating: number; count: number | null } | undefined;
  for (const path of site.reviewPaths) {
    const r = await fetchHtml(site.url + path);
    if (!r) continue;
    const ext = extractReviews(load(r.html), site.url + path);
    allReviews = allReviews.concat(ext.reviews);
    if (ext.aggregate && !aggregate) aggregate = ext.aggregate;
  }
  let revCount = 0;
  for (const rev of allReviews) {
    const ch = hash(domain + "|" + rev.body.slice(0, 120));
    const res = await q(
      `INSERT INTO reviews (clinic_id, rating, body, reviewer_name, source, source_url, content_hash, data_source)
       VALUES ($1,$2,$3,$4,'scraped',$5,$6,'scraped')
       ON CONFLICT (content_hash) DO NOTHING RETURNING id`,
      [clinicId, rev.rating ?? null, rev.body, rev.reviewer_name ?? null, rev.source_url ?? null, ch]
    );
    if (res.rows.length) revCount++;
  }
  // If NO individual reviews are stored for this clinic (e.g. a site whose
  // reviews sit behind a Google widget), fall back to the scraped aggregate.
  // When individual reviews DO exist, the trg_reviews_rating trigger owns
  // avg_rating/review_count — never override it (re-runs would clobber it).
  const stored = await q(
    `SELECT count(*)::int AS c FROM reviews WHERE clinic_id=$1 AND is_active=true`,
    [clinicId]
  );
  if (Number(stored.rows[0].c) === 0 && aggregate) {
    await q(`UPDATE clinics SET avg_rating=$2, review_count=$3 WHERE id=$1`, [
      clinicId,
      Math.min(5, Math.max(1, aggregate.rating)).toFixed(2),
      aggregate.count ?? 0,
    ]);
  }
  console.log(`  reviews: ${revCount}${aggregate ? ` (aggregate ${aggregate.rating}/${aggregate.count})` : ""}`);

  return {
    domain,
    clinicId,
    serviceCorpus: corpusParts.join(" "),
  };
}

async function fetchBeforeAfter(site: SiteCfg): Promise<ScrapedImage[]> {
  const out: ScrapedImage[] = [];
  for (const path of site.baPaths) {
    const r = await fetchHtml(site.url + path);
    if (!r) continue;
    out.push(...extractBeforeAfter(load(r.html), site.url + path));
  }
  return out;
}

async function main() {
  const ingested: SiteIngest[] = [];
  const allBA: ScrapedImage[] = [];

  for (const site of SITES) {
    const res = await ingestSite(site);
    if (res) ingested.push(res);
    allBA.push(...(await fetchBeforeAfter(site)));
  }

  // ── drop canonical services no longer offered by any clinic ───────────────
  const orphans = await q(
    `DELETE FROM services s
     WHERE NOT EXISTS (SELECT 1 FROM clinic_services cs WHERE cs.service_id = s.id)
     RETURNING name`
  );
  if (orphans.rows.length) {
    console.log(`\n🧹 removed ${orphans.rows.length} orphan services: ${orphans.rows.map((r: any) => r.name).join(", ")}`);
  }

  // ── derive concerns from the union of scraped service corpora ─────────────
  console.log(`\n🧠 Deriving concerns from scraped content...`);
  const corpus = ingested.map((i) => i.serviceCorpus).join(" ");

  let concernsCreated = 0;
  let linksCreated = 0;
  let baAttached = 0;

  // concern_services and concern before/after images are fully derived — rebuild
  // them from scratch so corrected mappings replace any stale ones.
  await q(`DELETE FROM concern_services`);
  await q(`DELETE FROM images WHERE entity_type='concern' AND role='before_after'`);

  for (const def of CONCERN_CATALOG) {
    const hasEvidence = def.triggers.some((t) => corpus.includes(t.toLowerCase()));
    if (!hasEvidence) {
      console.log(`  – skip "${def.name}" (no scraped evidence)`);
      continue;
    }

    const slug = slugify(def.name);
    const concern = await q(
      `INSERT INTO concerns (name, slug, overview, details, data_source, source_url, is_published)
       VALUES ($1,$2,$3,$4,'scraped',$5,true)
       ON CONFLICT (slug) DO UPDATE
         SET overview=EXCLUDED.overview, details=EXCLUDED.details, updated_at=NOW()
       RETURNING id`,
      [def.name, slug, def.overview, JSON.stringify(def.details),
       SITES.map((s) => s.url).join(", ")]
    );
    const concernId = concern.rows[0].id;
    concernsCreated++;

    // link matching canonical services (excludeKeywords kills false positives)
    const { rows: svcRows } = await q(`SELECT id, name FROM services WHERE is_active=true`);
    let order = 0;
    for (const svc of svcRows) {
      const nm = String(svc.name).toLowerCase();
      const included = def.serviceKeywords.some((k) => nm.includes(k.toLowerCase()));
      const excluded = (def.excludeKeywords ?? []).some((k) => nm.includes(k.toLowerCase()));
      if (included && !excluded) {
        const res = await q(
          `INSERT INTO concern_services (concern_id, service_id, display_order)
           VALUES ($1,$2,$3) ON CONFLICT (concern_id, service_id) DO NOTHING RETURNING id`,
          [concernId, svc.id, order++]
        );
        if (res.rows.length) linksCreated++;
      }
    }

    // attach before/after images by matching the treatment token in the image
    // URL filename (e.g. "Dysport-BeforeandAfter" → dysport). No round-robin —
    // a concern with no genuine match gets no images (precision over coverage).
    const chosen = allBA
      .filter((img) => {
        const fname = img.source_url.toLowerCase();
        return def.imageKeywords.some((k) => fname.includes(k.toLowerCase()));
      })
      .slice(0, 6);
    let so = 0;
    for (const img of chosen) {
      let domain: string | null = null;
      try {
        domain = new URL(img.source_url).hostname.replace(/^www\./, "");
      } catch {
        /* leave null */
      }
      const res = await q(
        `INSERT INTO images (entity_type, entity_id, source_url, role, sort_order, alt_text, scraped_domain, scrape_status)
         VALUES ('concern',$1,$2,'before_after',$3,$4,$5,'ok')
         ON CONFLICT (entity_type, entity_id, source_url)
           DO UPDATE SET scraped_domain = EXCLUDED.scraped_domain RETURNING id`,
        [concernId, img.source_url, so++, img.alt_text ?? null, domain]
      );
      if (res.rows.length) baAttached++;
    }
    console.log(`  ✓ "${def.name}" — linked services + ${chosen.length} before/after`);
  }

  // ── reconcile clinic ratings from stored individual reviews ───────────────
  // (clinics with no individual reviews keep their scraped aggregate)
  await q(`
    UPDATE clinics c SET avg_rating = sub.avg, review_count = sub.cnt
    FROM (
      SELECT clinic_id, ROUND(AVG(rating)::numeric, 2) AS avg, COUNT(*) AS cnt
      FROM reviews
      WHERE is_approved = true AND is_active = true AND rating IS NOT NULL
      GROUP BY clinic_id
    ) sub
    WHERE c.id = sub.clinic_id
  `);

  // ── refresh search view ───────────────────────────────────────────────────
  try {
    await q(`REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view`);
    console.log(`\n🔄 clinic_search_view refreshed`);
  } catch (e) {
    try {
      await q(`REFRESH MATERIALIZED VIEW clinic_search_view`);
      console.log(`\n🔄 clinic_search_view refreshed (non-concurrent)`);
    } catch (e2) {
      console.warn(`  ⚠ could not refresh view:`, (e2 as Error).message);
    }
  }

  console.log(`\n✅ Ingest complete:`);
  console.log(`   concerns: ${concernsCreated}, concern_services links: ${linksCreated}, before/after attached: ${baAttached}`);
  console.log(`   before/after images found: ${allBA.length}`);

  await pool.end();
}

main().catch((e) => {
  console.error("❌ ingest failed:", e);
  process.exit(1);
});
