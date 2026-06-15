/**
 * Iterates valid G99 businesses and tells Next.js to sync each one.
 * Runs in parallel batches of BATCH_SIZE for speed.
 * This server does NOT touch any database — all reads/writes happen in Next.js.
 */

import { getG99Businesses, syncBusiness } from "../api-client";
import { runInBatches } from "../batch";

const BATCH_SIZE = 5;

export async function runG99Sync(limit?: number): Promise<void> {
  console.log("── G99 Sync started ──────────────────────────────────────────");

  const all = await getG99Businesses();
  const businesses = limit ? all.slice(0, limit) : all;

  if (limit && all.length > limit) {
    console.log(`  found ${all.length} valid G99 businesses — processing first ${limit}`);
  } else {
    console.log(`  found ${businesses.length} valid G99 businesses`);
  }
  console.log(`  running in batches of ${BATCH_SIZE}\n`);

  let synced = 0;
  let failed = 0;
  const totalBatches = Math.ceil(businesses.length / BATCH_SIZE);

  const results = await runInBatches(businesses, BATCH_SIZE, async (biz, idx) => {
    const batchNum = Math.floor(idx / BATCH_SIZE) + 1;
    // Log batch start only at the first item in each chunk
    if (idx % BATCH_SIZE === 0) {
      console.log(`  [batch ${batchNum}/${totalBatches}] syncing ${Math.min(BATCH_SIZE, businesses.length - idx)} businesses...`);
    }
    const result = await syncBusiness(biz.id);
    return { name: result.name };
  });

  for (let i = 0; i < results.length; i++) {
    const biz = businesses[i];
    if (results[i].error) {
      failed++;
      console.error(`  ✗ ${biz.name} (g99=${biz.id}): ${results[i].error!.message}`);
    } else {
      synced++;
      console.log(`  ✓ ${results[i].value!.name}`);
    }
  }

  console.log(`\n── G99 Sync complete — ${synced} ok, ${failed} failed ─────────\n`);
}
