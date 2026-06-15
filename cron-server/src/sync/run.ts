/**
 * run.ts — run the full sync once and exit.
 * Usage: bun src/sync/run.ts [--limit=100]
 */

import "dotenv/config";
import { runG99Sync } from "./g99-sync";
import { runWebScraper } from "./web-scraper";
import { runImageFinder } from "./image-finder";
import { refreshView } from "../api-client";

const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const envLimit = process.env.SYNC_LIMIT ? parseInt(process.env.SYNC_LIMIT, 10) : 10000;
const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : envLimit;

async function main(): Promise<void> {
  const start = Date.now();
  console.log(`\n${"=".repeat(60)}`);
  console.log("MedSpaMaps Sync — starting");
  if (limit > 0) console.log(`  G99 limit: ${limit} businesses`);
  console.log(`${"=".repeat(60)}\n`);

  try {
    await runG99Sync(limit > 0 ? limit : undefined);
    await runWebScraper();
    await runImageFinder();

    const viewResult = await refreshView().then(() => "ok").catch((e: Error) => e.message);
    console.log(`✓ clinic_search_view: ${viewResult}`);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`\n${"=".repeat(60)}`);
    console.log(`✓ Sync complete in ${elapsed}s`);
    console.log(`${"=".repeat(60)}\n`);
    process.exit(0);
  } catch (err) {
    console.error("✗ Sync failed:", (err as Error).message);
    process.exit(1);
  }
}

main();
