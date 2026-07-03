/**
 * Medspa daily re-scrape cron server.
 *
 * A thin orchestrator: every day it pulls the list of clinics from the Next.js
 * app and asks Next.js to re-scrape each one. Next.js does the scraping, diffs
 * the treatments against what it had, applies the changes, and records every
 * canonical add/remove into clinic_service_changes. This process only talks
 * HTTP — it never touches the DB or runs a scraper itself.
 *
 *   Daily @ 03:00 : runRescrape()
 *   --run-once    : run a single pass now and exit (for manual runs / tests)
 *
 * Config (env):
 *   NEXTJS_URL             base URL of the Next.js app (default http://localhost:3000)
 *   INTERNAL_API_SECRET    shared secret sent as X-Internal-Secret
 *   RESCRAPE_CONCURRENCY   clinics scraped in parallel (default 5)
 *   RESCRAPE_LIMIT         cap total clinics per run (default: all)
 */

import * as dotenv from "dotenv";
dotenv.config();

import cron from "node-cron";
import { api, type ClinicRef, type RescrapeResult } from "./lib/api";

const CONCURRENCY = Math.max(
  1,
  parseInt(process.env.RESCRAPE_CONCURRENCY ?? "5", 10) || 5
);
const RUN_CAP = process.env.RESCRAPE_LIMIT
  ? parseInt(process.env.RESCRAPE_LIMIT, 10) || undefined
  : undefined;
const RUN_ONCE = process.argv.includes("--run-once");

/** Run `fn` over `items` with at most `limit` in flight at once. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

/**
 * Collect ALL eligible clinics up-front (before any re-scrape mutates
 * last_scraped_at), so offset paging stays stable. Ordered least-recently-
 * scraped first by the API, so a capped run still favours the stalest clinics.
 */
async function collectClinics(): Promise<ClinicRef[]> {
  const pageSize = 500;
  const all: ClinicRef[] = [];
  let offset = 0;
  let total = Infinity;
  while (offset < total) {
    const page = await api.listClinics(pageSize, offset);
    total = page.total;
    if (page.clinics.length === 0) break;
    all.push(...page.clinics);
    offset += page.clinics.length;
    if (page.clinics.length < pageSize) break;
    if (RUN_CAP && all.length >= RUN_CAP) break;
  }
  return RUN_CAP ? all.slice(0, RUN_CAP) : all;
}

async function runRescrape(): Promise<void> {
  const startedAt = Date.now();
  console.log(`\n${"=".repeat(64)}`);
  console.log(`[rescrape] started ${new Date().toISOString()}`);
  console.log(`[rescrape] concurrency=${CONCURRENCY} cap=${RUN_CAP ?? "none"}`);
  console.log("=".repeat(64));

  let clinics: ClinicRef[];
  try {
    clinics = await collectClinics();
  } catch (err) {
    console.error("[rescrape] could not list clinics:", err);
    return;
  }
  console.log(`[rescrape] ${clinics.length} eligible clinic(s)`);

  let ok = 0;
  let failed = 0;
  let skipped = 0;
  let clinicsChanged = 0;
  let totalAdded = 0;
  let totalRemoved = 0;
  const failures: Array<{ name: string; error: string }> = [];

  await mapLimit(clinics, CONCURRENCY, async (clinic) => {
    let result: RescrapeResult;
    try {
      result = await api.rescrapeClinic(clinic.id);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      failures.push({ name: clinic.name, error: msg });
      console.error(`[rescrape] ✗ ${clinic.name}: ${msg}`);
      return;
    }

    if (!result.ok) {
      if (result.skipped) skipped++;
      else failed++;
      if (result.error) failures.push({ name: clinic.name, error: result.error });
      console.warn(`[rescrape] ⚠ ${clinic.name}: ${result.error ?? "skipped"}`);
      return;
    }

    ok++;
    totalAdded += result.added.length;
    totalRemoved += result.removed.length;
    if (result.added.length || result.removed.length) {
      clinicsChanged++;
      const parts: string[] = [];
      if (result.added.length) parts.push(`+${result.added.map((a) => a.slug).join(", +")}`);
      if (result.removed.length) parts.push(`-${result.removed.map((r) => r.slug).join(", -")}`);
      console.log(`[rescrape] ✓ ${clinic.name}: ${parts.join("  ")}`);
    }
  });

  // Refresh the public search view so new offerings show up in search.
  try {
    await api.refreshView();
    console.log("[rescrape] search view refreshed");
  } catch (err) {
    console.error("[rescrape] view refresh failed (non-fatal):", err);
  }

  const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log("=".repeat(64));
  console.log(
    `[rescrape] done in ${secs}s — ok=${ok} changed=${clinicsChanged} ` +
      `skipped=${skipped} failed=${failed} | +${totalAdded} treatments / -${totalRemoved} treatments`
  );
  if (failures.length) {
    console.log(`[rescrape] ${failures.length} issue(s):`);
    for (const f of failures.slice(0, 25)) console.log(`   - ${f.name}: ${f.error}`);
    if (failures.length > 25) console.log(`   … and ${failures.length - 25} more`);
  }
  console.log("=".repeat(64));
}

async function waitForNextJS(timeoutMs = 45000): Promise<void> {
  const start = Date.now();
  console.log(`[rescrape] waiting for Next.js at ${api.base}/health …`);
  while (Date.now() - start < timeoutMs) {
    if (await api.health()) {
      console.log("[rescrape] Next.js is ready");
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.warn("[rescrape] Next.js not ready within timeout — proceeding anyway");
}

if (!process.env.INTERNAL_API_SECRET) {
  console.warn(
    "[rescrape] INTERNAL_API_SECRET is not set — internal API calls will be rejected (401)."
  );
}

if (RUN_ONCE) {
  waitForNextJS()
    .then(runRescrape)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[rescrape] fatal:", err);
      process.exit(1);
    });
} else {
  console.log("[rescrape] scheduler started — daily re-scrape at 03:00");
  cron.schedule("0 3 * * *", () => {
    runRescrape().catch((err) => console.error("[rescrape] uncaught:", err));
  });
  // Do an initial run on boot so a fresh deploy doesn't wait a whole day.
  waitForNextJS()
    .then(runRescrape)
    .catch((err) => console.error("[rescrape] initial run error:", err));
}
