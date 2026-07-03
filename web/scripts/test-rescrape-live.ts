/**
 * test-rescrape-live.ts — live end-to-end test of the daily re-scrape against a
 * REAL website. Proves the "new treatments get added on the next scrape" path.
 *
 *   bun scripts/test-rescrape-live.ts scrape  <url>
 *       — run the detector on the live site, print the full detected canonical set.
 *
 *   bun scripts/test-rescrape-live.ts seed    <url> <name> <slug1,slug2,...>
 *       — add a clinic for <url> with ONLY the given subset of treatments,
 *         marked as the stalest clinic (so a capped cron run targets it).
 *
 *   bun scripts/test-rescrape-live.ts report  <url>
 *       — print the clinic's current active canonical set + its change log.
 *
 *   bun scripts/test-rescrape-live.ts cleanup <url>
 *       — delete the test clinic + business.
 */

import { Pool } from "pg";
import * as dotenv from "dotenv";
import { detectClinicServices } from "@/lib/rescrape/detect";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function domainOf(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url;
  }
}

async function findClinic(url: string) {
  const dom = domainOf(url);
  return pool.query<{ id: string; business_id: string; name: string }>(
    `SELECT id, business_id, name FROM clinics
      WHERE lower(regexp_replace(regexp_replace(website,'^https?://',''),'^www\\.','')) LIKE $1`,
    [`${dom}%`]
  );
}

async function cleanup(url: string) {
  const r = await findClinic(url);
  for (const row of r.rows) {
    await pool.query("DELETE FROM clinics WHERE id = $1", [row.id]);
    await pool.query("DELETE FROM businesses WHERE id = $1", [row.business_id]);
    console.log(`deleted clinic ${row.name} (${row.id})`);
  }
  if (r.rows.length === 0) console.log("no matching clinic to clean up");
}

async function main() {
  const [mode, url, arg3, arg4] = process.argv.slice(2);

  if (mode === "scrape") {
    const det = await detectClinicServices(url);
    console.log(JSON.stringify({
      scrapedUrl: det.scrapedUrl,
      pagesVisited: det.pagesVisited,
      detectedSlugs: det.matchedSlugs.sort(),
      matchedRaw: det.services.filter((s) => !s.is_noise && s.slug)
        .map((s) => ({ raw_name: s.raw_name, slug: s.slug, confidence: +s.confidence.toFixed(2) })),
    }, null, 2));
  } else if (mode === "seed") {
    const name = arg3;
    const slugs = (arg4 || "").split(",").map((s) => s.trim()).filter(Boolean);
    await cleanup(url); // fresh
    const website = url.startsWith("http") ? url : `https://${url}`;
    const biz = await pool.query<{ id: string }>(
      `INSERT INTO businesses (name, data_source) VALUES ($1,'scraped') RETURNING id`,
      [name]
    );
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const clinic = await pool.query<{ id: string }>(
      `INSERT INTO clinics (business_id, name, slug, website, data_source, is_active, last_scraped_at)
       VALUES ($1,$2,$3,$4,'scraped',true,'1970-01-01T00:00:00Z') RETURNING id`,
      [biz.rows[0].id, name, slug, website]
    );
    const clinicId = clinic.rows[0].id;
    const svc = await pool.query<{ id: string; name: string; slug: string }>(
      `SELECT id, name, slug FROM services WHERE slug = ANY($1::text[])`,
      [slugs]
    );
    for (const s of svc.rows) {
      await pool.query(
        `INSERT INTO clinic_services
           (clinic_id, service_id, raw_name, match_status, match_confidence, data_source, is_active, last_scraped_at)
         VALUES ($1,$2,$3,'matched',1,'scraped',true,NOW())`,
        [clinicId, s.id, s.name]
      );
    }
    console.log(JSON.stringify({ clinicId, seededSlugs: svc.rows.map((s) => s.slug).sort() }, null, 2));
  } else if (mode === "report") {
    const r = await findClinic(url);
    if (r.rows.length === 0) { console.log("clinic not found"); await pool.end(); process.exit(0); }
    const clinicId = r.rows[0].id;
    const active = await pool.query<{ slug: string }>(
      `SELECT DISTINCT s.slug FROM clinic_services cs JOIN services s ON s.id = cs.service_id
        WHERE cs.clinic_id = $1 AND cs.is_active = true ORDER BY s.slug`,
      [clinicId]
    );
    const changes = await pool.query<{ service_slug: string; change_type: string; detected: string }>(
      `SELECT service_slug, change_type, to_char(detected_at,'YYYY-MM-DD HH24:MI') AS detected
         FROM clinic_service_changes WHERE clinic_id = $1 ORDER BY change_type, service_slug`,
      [clinicId]
    );
    console.log(JSON.stringify({
      clinicId,
      activeCanonical: active.rows.map((x) => x.slug),
      changeLog: changes.rows,
    }, null, 2));
  } else if (mode === "cleanup") {
    await cleanup(url);
  } else {
    console.log("usage: scrape|seed|report|cleanup <url> ...");
  }

  await pool.end();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
