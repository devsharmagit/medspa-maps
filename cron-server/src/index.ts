import * as dotenv from "dotenv";
dotenv.config();

import cron from "node-cron";
import { runG99Sync } from "./sync/g99-sync";
import { runManualSync } from "./sync/manual-sync";
import { api } from "./lib/api-client";

const SYNC_LIMIT = process.env.SYNC_LIMIT
  ? parseInt(process.env.SYNC_LIMIT, 10) || undefined
  : undefined;

async function runFullSync(): Promise<void> {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[cron] Full sync started at ${new Date().toISOString()}`);
  console.log(`[cron] SYNC_LIMIT = ${SYNC_LIMIT ?? "none (all records)"}`);
  console.log("=".repeat(60));

  try {
    await runG99Sync(SYNC_LIMIT);
  } catch (err) {
    console.error("[cron] G99 sync crashed:", err);
  }

  try {
    await runManualSync();
  } catch (err) {
    console.error("[cron] Manual sync crashed:", err);
  }

  try {
    await api.refreshView();
    console.log("[cron] Materialized view refreshed");
  } catch (err) {
    console.error("[cron] View refresh failed:", err);
  }

  console.log(`[cron] Full sync finished at ${new Date().toISOString()}`);
  console.log("=".repeat(60));
}

const RUN_ONCE = process.argv.includes("--run-once");

if (RUN_ONCE) {
  runFullSync()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[cron] Fatal:", err);
      process.exit(1);
    });
} else {
  console.log("[cron] Scheduler started. Daily sync at 3:00 AM.");

  cron.schedule("0 3 * * *", () => {
    runFullSync().catch((err) => console.error("[cron] Uncaught:", err));
  });

  runFullSync().catch((err) => console.error("[cron] Initial sync error:", err));
}
