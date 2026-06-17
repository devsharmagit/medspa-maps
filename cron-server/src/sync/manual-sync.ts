import { api } from "../lib/api-client";
import { scrapeWebsite, isScrapableUrl } from "../lib/scraper";

const CONCURRENCY = 3;

export async function runManualSync(): Promise<void> {
  console.log("[manual-sync] Starting...");
  const startedAt = Date.now();

  const clinics = await api.getManualClinics();
  console.log(`[manual-sync] ${clinics.length} manual clinics to scrape`);

  let done = 0;
  let scraped = 0;
  let skipped = 0;

  for (let i = 0; i < clinics.length; i += CONCURRENCY) {
    const batch = clinics.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (clinic) => {
        if (!isScrapableUrl(clinic.website)) {
          skipped++;
          done++;
          return;
        }

        try {
          const result = await scrapeWebsite(clinic.website);
          if (result) {
            await api.storeScrape({
              clinicId: clinic.id,
              businessId: clinic.business_id,
              scrapeResult: result,
            });
            scraped++;
          } else {
            skipped++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(
            `[manual-sync] Clinic ${clinic.id} (${clinic.website}): ${msg}`
          );
          skipped++;
        }
        done++;
      })
    );
    console.log(`[manual-sync] ${done}/${clinics.length} done`);
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `[manual-sync] Done in ${elapsed}s — ${scraped} scraped, ${skipped} skipped`
  );
}
