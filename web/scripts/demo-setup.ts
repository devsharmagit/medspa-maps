/**
 * demo-setup.ts — add a clinic with FULL accurate details but a deliberately
 * wrong treatment set, so the daily re-scrape produces both adds and removes.
 *
 *   bun scripts/demo-setup.ts "<url>"
 *
 * Per clinic it:
 *   1. scrapeClinicPreview(url) — real name / address / images / reviews / services
 *   2. keeps only PART of the real treatments (drops a few → cron will ADD them)
 *      and injects a couple of treatments the site does NOT offer
 *      (→ cron will REMOVE them)
 *   3. saveClinicBundle(...) — persists the full accurate clinic
 *   4. backdates last_scraped_at so a capped cron run targets it
 *
 * Prints exactly what the cron should later show as added / removed.
 */

import { Pool } from "pg";
import * as dotenv from "dotenv";
import { scrapeClinicPreview } from "@/lib/admin/scrape-preview";
import { saveClinicBundle, type ClinicBundle, type SaveService } from "@/lib/admin/clinic-save";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Treatments we inject as "already offered" that a site likely does NOT have,
// so the cron flags them removed. We only use ones NOT in the detected set.
const PREFERRED_FAKES = [
  "coolsculpting",
  "ultherapy",
  "body-contouring",
  "ipl-photofacial",
  "rf-skin-tightening",
  "pdo-threads",
  "laser-hair-removal",
];

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("usage: bun scripts/demo-setup.ts <url>");
    process.exit(1);
  }

  // canonical slug -> display name (for fabricated service raw_names)
  const svcRows = (
    await pool.query<{ slug: string; name: string }>(
      `SELECT slug, name FROM services WHERE is_active = true`
    )
  ).rows;
  const nameBySlug = new Map(svcRows.map((r) => [r.slug, r.name]));

  console.log(`\n▶ ${url}`);
  const preview = await scrapeClinicPreview(url);

  // detected canonical set
  const detected = Array.from(
    new Set(
      preview.services
        .filter((s) => !s.is_noise && s.suggestion?.slug)
        .map((s) => s.suggestion!.slug)
    )
  ).sort();

  if (detected.length < 3) {
    console.warn(`  ⚠ only ${detected.length} treatments detected — small demo`);
  }

  // drop the last few real treatments (cron will ADD them back)
  const omitCount = Math.min(3, Math.max(1, detected.length - 2));
  const keep = detected.slice(0, detected.length - omitCount);
  const willAdd = detected.slice(detected.length - omitCount);

  // inject up to 2 treatments not on the site (cron will REMOVE them)
  const willRemove = PREFERRED_FAKES.filter((s) => !detected.includes(s)).slice(0, 2);

  // build the (wrong) initial service list: real services that map to `keep`,
  // plus fabricated services for the fakes.
  const keepServices: SaveService[] = preview.services.filter(
    (s) => !s.is_noise && s.suggestion?.slug && keep.includes(s.suggestion.slug)
  );
  const fakeServices: SaveService[] = willRemove.map((slug) => ({
    raw_name: nameBySlug.get(slug) ?? slug,
    mapped_slug: slug,
  }));

  const bundle: ClinicBundle = {
    website: preview.website,
    business: preview.business,
    locations: preview.locations,
    services: [...keepServices, ...fakeServices],
    images: preview.images,
    reviews: preview.reviews,
    ext_rating: preview.ext_rating,
    ext_review_count: preview.ext_review_count,
  };

  const res = await saveClinicBundle(bundle, { overwrite: true });
  const clinicId = res.clinics[0].id;

  // backdate so a capped cron run (RESCRAPE_LIMIT) targets these clinics
  await pool.query(
    `UPDATE clinics SET last_scraped_at = '1970-01-01T00:00:00Z' WHERE id = $1`,
    [clinicId]
  );

  const loc = preview.locations[0] ?? {};
  console.log(`  ✓ saved "${preview.business.name}" (clinic ${clinicId})`);
  console.log(`     address:  ${[loc.address, loc.city, loc.state, loc.zip].filter(Boolean).join(", ") || "(none parsed)"}`);
  console.log(`     images:   ${(preview.images.gallery?.length ?? 0) + (preview.images.logo ? 1 : 0) + (preview.images.before_after?.length ?? 0)}   reviews: ${preview.reviews.length}   rating: ${preview.ext_rating ?? "-"}`);
  console.log(`     detected on site: [${detected.join(", ")}]`);
  console.log(`     seeded now:       [${[...keep, ...willRemove].sort().join(", ")}]  (kept real: ${keep.length}, injected fake: ${willRemove.length})`);
  console.log(`     → cron should ADD:    [${willAdd.join(", ")}]`);
  console.log(`     → cron should REMOVE: [${willRemove.join(", ")}]`);

  await pool.end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
