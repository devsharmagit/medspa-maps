/**
 * scripts/fill-clinic-before-after.ts — backfill BEFORE/AFTER (B&A) images for
 * clinics that currently have none. Reuses the existing standalone B&A ingest
 * (`ingestBeforeAfterByDomain`) which discovers the clinic's gallery/results
 * page, collects candidates, AI-classifies the ambiguous ones via OpenAI
 * (gpt-4o-mini vision — heuristic-first, so AI only fires on uncertain gallery
 * images), de-dups against cover/gallery/logo, and inserts ONLY role='before_after'
 * rows. Idempotent; touches nothing else.
 *
 * Constraints honored: max 8 images/clinic (trimmed after insert — the library
 * caps at 10), and clinics whose site has no B&A are skipped (found=0 → no rows).
 * The ingestion pipeline is NOT modified — this only calls its library code.
 *
 *   bun scripts/fill-clinic-before-after.ts                    # preview (no writes)
 *   bun scripts/fill-clinic-before-after.ts --clinic=<slug|id> # one clinic
 *   bun scripts/fill-clinic-before-after.ts --limit=10         # first N
 *   bun scripts/fill-clinic-before-after.ts --apply            # write
 */
import "dotenv/config";
import pool, { query } from "../src/lib/db";
import { fetchHtml, load, normalizeUrl } from "../src/lib/scraper/utils";
import { websiteDomain } from "../src/lib/admin/clinic-save";
import { discoverContentPages } from "../src/lib/ingest/discover";
import { newBeforeAfterCandidates, scanPageForBeforeAfter, resolveBeforeAfter } from "../src/lib/ingest/before-after";
import { ingestBeforeAfterByDomain } from "../src/lib/ingest/ingest-before-after";

const APPLY = process.argv.includes("--apply");
const clinicArg = process.argv.find((a) => a.startsWith("--clinic="))?.split("=")[1];
const limitArg = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1]) || 0;
const CONCURRENCY = 4;
const MAX = 8;

interface Clinic { id: string; name: string; slug: string; website: string; }
const stats = { touched: 0, inserted: 0, trimmed: 0, skippedNoBA: 0, failed: 0 };

/** Preview: mirror ingestBeforeAfterByDomain steps 1-4 without persisting. */
async function preview(c: Clinic): Promise<string[] | null> {
  const domain = websiteDomain(c.website);
  const home = await fetchHtml(normalizeUrl(c.website));
  if (!home) return null;
  const $home = load(home.html);
  const finalUrl = home.finalUrl || c.website;

  const baCands = newBeforeAfterCandidates();
  scanPageForBeforeAfter(baCands, $home, finalUrl, { isHome: true });
  for (const u of await discoverContentPages($home, finalUrl)) {
    const r = await fetchHtml(u);
    if (r) scanPageForBeforeAfter(baCands, load(r.html), u);
  }
  const existing = await query<{ source_url: string }>(
    `SELECT source_url FROM images WHERE entity_type='clinic' AND entity_id=$1 AND role IN ('cover','gallery','logo')`,
    [c.id]);
  const rows = await resolveBeforeAfter(baCands, {
    excludeUrls: new Set(existing.map((r) => r.source_url)),
    businessName: c.name,
    domain,
  });
  return rows.map((r) => r.source_url).slice(0, MAX);
}

/** Enforce the max-8 cap (library caps at 10) — drop scraped rows past sort_order 7. */
async function trimTo8(clinicId: string): Promise<number> {
  const del = await query<{ id: string }>(
    `DELETE FROM images
      WHERE entity_type='clinic' AND entity_id=$1 AND role='before_after'
        AND cdn_url IS NULL AND storage_key IS NULL AND sort_order >= $2
      RETURNING id`,
    [clinicId, MAX]);
  return del.length;
}

async function processClinic(c: Clinic): Promise<void> {
  if (!APPLY) {
    const urls = await preview(c);
    if (!urls) { stats.failed++; console.log(`  ✗ ${c.name} — homepage unreachable`); return; }
    if (urls.length === 0) { stats.skippedNoBA++; console.log(`  · ${c.name} — no before/after found (skip)`); return; }
    stats.touched++; stats.inserted += urls.length;
    console.log(`  ✓ ${c.name} — ${urls.length} B&A image(s)`);
    for (const u of urls) console.log(`      - ${u.slice(0, 95)}`);
    return;
  }

  const res = await ingestBeforeAfterByDomain(c.website);
  if (res.status === "failed") { stats.failed++; console.log(`  ✗ ${c.name} — ${res.note ?? "failed"}`); return; }
  if (res.inserted === 0) { stats.skippedNoBA++; console.log(`  · ${c.name} — no before/after found (skip)`); return; }
  const trimmed = res.clinicId ? await trimTo8(res.clinicId) : 0;
  stats.touched++; stats.inserted += res.inserted - trimmed; stats.trimmed += trimmed;
  console.log(`  ✓ ${c.name} — ${res.inserted - trimmed} B&A image(s)${trimmed ? ` (trimmed ${trimmed} over cap)` : ""}`);
}

async function runPool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { await fn(items[idx]); } catch (e) { stats.failed++; console.warn(`  ! error: ${e instanceof Error ? e.message : e}`); }
    }
  }));
}

async function main() {
  if (!process.env.OPENAI_API_KEY) console.warn("⚠ OPENAI_API_KEY not set — only filename-certain B&A will be found (no AI classification).\n");
  let sql = `
    SELECT c.id, c.name, c.slug, c.website
    FROM clinics c
    WHERE c.is_active=true AND c.website IS NOT NULL AND length(c.website)>0
      AND NOT EXISTS(SELECT 1 FROM images i WHERE i.entity_type='clinic' AND i.entity_id=c.id
                       AND i.role='before_after' AND i.scrape_status='ok')`;
  const params: unknown[] = [];
  if (clinicArg) { sql += ` AND (c.slug=$1 OR c.id::text=$1)`; params.push(clinicArg); }
  sql += ` ORDER BY c.name`;
  if (limitArg) sql += ` LIMIT ${limitArg}`;
  const clinics = await query<Clinic>(sql, params);

  console.log(`${APPLY ? "APPLY" : "PREVIEW"} — ${clinics.length} clinic(s) without before/after\n`);
  await runPool(clinics, CONCURRENCY, processClinic);

  console.log(`\n──────── summary ────────`);
  console.log(`clinics with B&A added: ${stats.touched}`);
  console.log(`B&A images ${APPLY ? "inserted" : "found"}: ${stats.inserted}`);
  if (APPLY) console.log(`trimmed over cap 8:     ${stats.trimmed}`);
  console.log(`skipped (no B&A):       ${stats.skippedNoBA}`);
  console.log(`failed:                 ${stats.failed}`);
  if (!APPLY) console.log(`\n(preview only — re-run with --apply to write)`);
  await pool.end().catch(() => {});
  // Force a clean exit: a broken pg connection (from a network blip) can leave
  // the event loop spinning after the work is done, so the process never exits.
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
