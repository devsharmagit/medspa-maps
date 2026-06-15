/**
 * Iterates valid G99 businesses and tells Next.js to sync each one.
 * This server does NOT touch any database — all reads/writes happen in Next.js.
 */

import { getG99Businesses, syncBusiness } from "../api-client";

export async function runG99Sync(limit?: number): Promise<void> {
  console.log("── G99 Sync started ──────────────────────────────────────────");

  const all = await getG99Businesses();
  const businesses = limit ? all.slice(0, limit) : all;

  if (limit && all.length > limit) {
    console.log(`  found ${all.length} valid G99 businesses — processing first ${limit}`);
  } else {
    console.log(`  found ${businesses.length} valid G99 businesses`);
  }

  let synced = 0;
  let failed = 0;

  for (const biz of businesses) {
    try {
      const result = await syncBusiness(biz.id);
      console.log(`  ✓ ${result.name}`);
      synced++;
    } catch (err) {
      failed++;
      console.error(`  ✗ ${biz.name} (g99=${biz.id}): ${(err as Error).message}`);
    }
  }

  console.log(`── G99 Sync complete — ${synced} ok, ${failed} failed ─────────\n`);
}
