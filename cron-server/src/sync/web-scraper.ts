/**
 * web-scraper.ts — nightly clinic website scraper.
 *
 * For each non-G99 clinic:
 *   1. Create a scrape job record
 *   2. Call /api/internal/scrape to run Cheerio scraper on the clinic's website
 *   3. Save the full result via /api/internal/clinics/[id]/full-scrape
 *   4. Update the job record with result counts
 *
 * All DB writes go through the Next.js API — this server never touches the DB.
 */

import {
  getNonG99Clinics,
  scrapeUrl,
  saveClinicFullScrape,
  createScrapeJob,
  updateScrapeJob,
  type ClinicForScrape,
} from "../api-client";
import { runInBatches } from "../batch";

const BATCH_SIZE = 3; // scraping is heavy — fewer parallel requests

export async function runWebScraper(): Promise<void> {
  console.log("── Web Scraper started ───────────────────────────────────────");

  const clinics = await getNonG99Clinics();
  console.log(`  ${clinics.length} non-G99 clinics to scrape`);
  console.log(`  running in batches of ${BATCH_SIZE}\n`);

  const results = await runInBatches(clinics, BATCH_SIZE, scrapeClinic);

  const ok = results.filter((r) => !r.error).length;
  const failed = results.filter((r) => r.error).length;

  console.log(`\n── Web Scraper complete — ${ok} ok, ${failed} failed ─────────\n`);
}

async function scrapeClinic(clinic: ClinicForScrape): Promise<void> {
  const jobId = await createScrapeJob({
    clinic_id: clinic.id,
    target_url: clinic.website,
    job_type: "full",
  }).catch(() => null);

  try {
    console.log(`  ⏳ ${clinic.name} → ${clinic.website}`);

    const result = await scrapeUrl(clinic.website);

    if (result.pages_visited.length === 0) {
      console.log(`  ✗ ${clinic.name} — site unreachable`);
      if (jobId) {
        await updateScrapeJob(jobId, { status: "failed", error_message: "site unreachable" });
      }
      return;
    }

    const saved = await saveClinicFullScrape(clinic.id, {
      ...result,
      job_id: jobId ?? undefined,
    });

    console.log(
      `  ✓ ${clinic.name} — ` +
      `${saved.saved.services} services, ` +
      `${saved.saved.providers} providers, ` +
      `${saved.saved.images} images`
    );

    if (jobId) {
      await updateScrapeJob(jobId, {
        status: "done",
        services_found: saved.saved.services,
        providers_found: saved.saved.providers,
        images_found: saved.saved.images,
      });
    }
  } catch (err) {
    const msg = (err as Error).message;
    console.log(`  ✗ ${clinic.name} — ${msg}`);
    if (jobId) {
      await updateScrapeJob(jobId, { status: "failed", error_message: msg });
    }
    throw err;
  }
}
