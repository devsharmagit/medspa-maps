/**
 * Medspa treatments + concerns refresh cron server.
 *
 * A thin orchestrator: on schedule it pulls the list of clinics from the Next.js
 * app and asks Next.js to refresh each one. Next.js runs the SAME AI ingest
 * engine the admin "Add Website with AI" button runs, diffs the result against
 * what it had, applies the changes atomically, and records the run plus every
 * canonical add/remove into `clinic_refresh_runs` / `clinic_catalog_changes`.
 * This process only talks HTTP — it never touches the DB or scrapes itself.
 *
 *   On CRON_SCHEDULE : runRescrape()
 *   --run-once       : run a single pass now and exit (for manual runs / tests)
 *
 * Config (env):
 *   NEXTJS_URL             base URL of the Next.js app (default http://localhost:3000)
 *   INTERNAL_API_SECRET    shared secret sent as X-Internal-Secret
 *   CRON_SCHEDULE          cron expression (default monthly, 03:00 on the 1st)
 *   RESCRAPE_CONCURRENCY   clinics refreshed in parallel (default 2)
 *   RESCRAPE_LIMIT         cap total clinics per run (default: all)
 *   RESCRAPE_STALE_DAYS    only refresh clinics not refreshed in N days (default 21)
 *   RESCRAPE_ON_BOOT       "true" to also run once at startup (default false)
 */

import * as dotenv from "dotenv";
dotenv.config();

import cron from "node-cron";
import { api, type ClinicRef, type RefreshResult } from "./lib/api";

/**
 * Each clinic now costs an AI crawl, not a cheap heuristic scrape. At 5, this is
 * ~15 concurrent OpenAI calls and ~50 concurrent page fetches from the same box
 * that serves the public site — and provider 429s are exactly what blows the
 * per-clinic time budget. 2 is the safe default; raise it after measuring.
 */
const CONCURRENCY = Math.max(
  1,
  parseInt(process.env.RESCRAPE_CONCURRENCY ?? "2", 10) || 2
);
const RUN_CAP = process.env.RESCRAPE_LIMIT
  ? parseInt(process.env.RESCRAPE_LIMIT, 10) || undefined
  : undefined;
/**
 * Skip clinics refreshed recently. A full pass over ~850 clinics takes hours, so
 * this is what makes the job restart-safe: a crashed or redeployed run resumes
 * where it left off instead of starting over.
 */
const STALE_DAYS = Math.max(
  0,
  parseInt(process.env.RESCRAPE_STALE_DAYS ?? "21", 10) || 0
);
/** Monthly by default — medspa menus do not change week to week. */
const SCHEDULE = process.env.CRON_SCHEDULE?.trim() || "0 3 1 * *";
/**
 * Off by default. With a monthly schedule, running on boot would mean every
 * deploy kicks off a full paid AI pass over the whole directory.
 */
const ON_BOOT = /^(1|true|yes)$/i.test(process.env.RESCRAPE_ON_BOOT ?? "");
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
    const page = await api.listClinics(pageSize, offset, STALE_DAYS);
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
  console.log(
    `[rescrape] concurrency=${CONCURRENCY} cap=${RUN_CAP ?? "none"} ` +
      `staleDays=${STALE_DAYS || "off"}`
  );
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
  let totalServices = 0;
  let totalConcerns = 0;
  const failures: Array<{ name: string; error: string }> = [];

  await mapLimit(clinics, CONCURRENCY, async (clinic) => {
    let result: RefreshResult;
    try {
      result = await api.refreshClinic(clinic.id);
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
    totalServices += result.servicesFound;
    totalConcerns += result.concernsFound;
    if (result.added.length || result.removed.length) {
      clinicsChanged++;
      const parts: string[] = [];
      const label = (d: { slug: string | null; name: string }) => d.slug ?? d.name;
      if (result.added.length) parts.push(`+${result.added.map(label).join(", +")}`);
      if (result.removed.length) parts.push(`-${result.removed.map(label).join(", -")}`);
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
      `skipped=${skipped} failed=${failed} | +${totalAdded} / -${totalRemoved} catalog rows | ` +
      `${totalServices} treatments, ${totalConcerns} concerns saved`
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
} else if (!cron.validate(SCHEDULE)) {
  console.error(`[rescrape] CRON_SCHEDULE is not a valid cron expression: "${SCHEDULE}"`);
  process.exit(1);
} else {
  console.log(`[rescrape] scheduler started — schedule "${SCHEDULE}"`);
  cron.schedule(SCHEDULE, () => {
    runRescrape().catch((err) => console.error("[rescrape] uncaught:", err));
  });
  if (ON_BOOT) {
    waitForNextJS()
      .then(runRescrape)
      .catch((err) => console.error("[rescrape] initial run error:", err));
  } else {
    console.log(
      "[rescrape] skipping the boot run (set RESCRAPE_ON_BOOT=true to enable) — " +
        "a full pass is a paid AI run over every clinic."
    );
  }
}
