/**
 * index.ts — cron server entry point.
 * Runs the full sync every day at 03:00 UTC.
 *
 * Start: bun src/index.ts
 */

import "dotenv/config";
import cron from "node-cron";
import { runG99Sync } from "./sync/g99-sync";
import { runWebScraper } from "./sync/web-scraper";
import { runImageFinder } from "./sync/image-finder";
import { refreshView } from "./api-client";

const NEXTJS_URL = process.env.NEXTJS_URL ?? "http://localhost:3000";
console.log(`MedSpaMaps cron server started — Next.js at ${NEXTJS_URL}`);
console.log("Scheduled: daily at 03:00 UTC\n");

async function runFullSync(): Promise<void> {
  const start = Date.now();
  console.log(`\n${"=".repeat(60)}`);
  console.log(`MedSpaMaps Sync — ${new Date().toISOString()}`);
  console.log(`${"=".repeat(60)}\n`);

  try {
    // Production: no limit — sync all valid businesses
    await runG99Sync();
    await runWebScraper();
    await runImageFinder();
    await refreshView().catch((e: Error) =>
      console.log(`⚠ view refresh: ${e.message}`)
    );

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n✓ Sync complete in ${elapsed}s\n`);
  } catch (err) {
    console.error("✗ Sync failed:", (err as Error).message);
  }
}

// Run daily at 03:00 UTC
cron.schedule("0 3 * * *", runFullSync, { timezone: "UTC" });
