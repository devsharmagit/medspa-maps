import { api } from "../lib/api-client";
import { scrapeWebsite, isScrapableUrl } from "../lib/scraper";
import type { G99Business } from "../types";

const CONCURRENCY = 5;

export async function runG99Sync(limit?: number): Promise<void> {
  console.log("[g99-sync] Starting...");
  const startedAt = Date.now();

  const businesses = await api.getG99Businesses();
  const toProcess = limit ? businesses.slice(0, limit) : businesses;
  console.log(
    `[g99-sync] ${businesses.length} businesses in G99 (processing ${toProcess.length})`
  );

  const seenBusinessIds: number[] = [];
  const seenClinicIds: number[] = [];
  let bDone = 0;
  let cScraped = 0;
  let cFailed = 0;

  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    const batch = toProcess.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (biz) => {
        const result = await processBusiness(biz, seenClinicIds);
        seenBusinessIds.push(biz.business_id);
        bDone++;
        cScraped += result.scraped;
        cFailed += result.failed;
      })
    );
    console.log(`[g99-sync] ${bDone}/${toProcess.length} businesses done`);
  }

  // Deactivate records no longer in G99
  const stale = await api.deactivateStale(seenClinicIds, seenBusinessIds);
  console.log(
    `[g99-sync] Deactivated ${stale.clinics_deactivated} clinics, ${stale.businesses_deactivated} businesses`
  );

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[g99-sync] Done in ${elapsed}s — ${cScraped} scraped, ${cFailed} skipped`
  );
}

async function processBusiness(
  biz: G99Business,
  seenClinicIds: number[]
): Promise<{ scraped: number; failed: number }> {
  let scraped = 0;
  let failed = 0;

  // Skip the entire business if none of its clinics have a valid website
  const validClinics = biz.clinics.filter((c) => isScrapableUrl(c.clinic_website));
  if (validClinics.length === 0) {
    console.log(
      `[g99-sync] Skipping business ${biz.business_id} (${biz.business_name}) — no clinics with a valid website`
    );
    return { scraped, failed };
  }

  try {
    const { our_business_id } = await api.upsertBusiness(biz);

    for (const clinic of biz.clinics) {
      // Skip clinics with no valid website — don't write them to the DB
      if (!isScrapableUrl(clinic.clinic_website)) {
        console.log(
          `[g99-sync] Skipping clinic ${clinic.clinic_id} (${clinic.clinic_name}) — website is null or invalid`
        );
        continue;
      }

      seenClinicIds.push(clinic.clinic_id);

      try {
        const { our_clinic_id } = await api.upsertClinic(our_business_id, clinic);

        const result = await scrapeWebsite(clinic.clinic_website!);
        if (result) {
          await api.storeScrape({
            clinicId: our_clinic_id,
            businessId: our_business_id,
            scrapeResult: result,
          });
          scraped++;
        } else {
          failed++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[g99-sync] Clinic ${clinic.clinic_id} (${clinic.clinic_name}): ${msg}`
        );
        failed++;
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[g99-sync] Business ${biz.business_id} (${biz.business_name}): ${msg}`
    );
  }

  return { scraped, failed };
}
