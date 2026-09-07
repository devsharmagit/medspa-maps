/**
 * test-refresh-e2e.ts — guard the three regressions the unified refresh can
 * introduce. No network and no AI: it seeds a clinic, then drives the same
 * save/diff/log code the engine uses, so it runs in seconds and for free.
 *
 *   bun --env-file=.env scripts/test-refresh-e2e.ts
 *
 * Asserts:
 *   1. A scraped name that resolves to nothing in the catalog is DROPPED, not
 *      stored as a dangling row — that is how phone numbers and street addresses
 *      used to become searchable treatments.
 *   2. A first import writes a run row but ZERO change rows; a second identical
 *      run writes zero change rows; and a genuine removal writes exactly one.
 *   3. The save is atomic — a throw mid-transaction leaves the menu untouched
 *      and writes no run row.
 *   4. The catalog stays CLOSED: a refresh never adds an active services or
 *      concerns row. Before the closed-catalog gate this test itself minted an
 *      active "Kybella" row on every run — defect 6 in docs/INGESTION-ISSUES.md,
 *      the exact mechanism by which the monthly cron would have undone the
 *      2026-09-06 reduction.
 *   5. A non-core name still lands on the core entry that absorbed it, via
 *      LEGACY_TREATMENT_REDIRECT, rather than being dropped.
 *   6. Website-verified rows ("<Core Name> (verified)", written by
 *      apply-verdicts.ts) survive an overwrite refresh.
 *
 * Cleans up after itself (the clinic delete cascades to every child row).
 */

import pool, { query, queryOne, withTransaction } from "../src/lib/db";
import { saveClinicServices, type SaveService } from "../src/lib/admin/clinic-save";
import { readCatalogSnapshot, writeCatalogChanges, writeRefreshRun } from "../src/lib/ingest/change-log";
import { loadConcernCatalog, resolveConcernRow } from "../src/lib/ingest/ingest-treatments-concerns";
import { diffCatalog } from "../src/lib/ingest/catalog-diff";

const SLUG = "zz-refresh-e2e-fixture";
let failures = 0;

function check(label: string, ok: boolean, detail?: string): void {
  console.log(`${ok ? "  ✓" : "  ✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

/** Mirror of the engine's save+log transaction, minus crawl and AI. */
async function refresh(clinicId: string, services: SaveService[]) {
  return withTransaction(async (client) => {
    const before = await readCatalogSnapshot(client, clinicId);
    await saveClinicServices(clinicId, services, { overwrite: true, client });
    const after = await readCatalogSnapshot(client, clinicId);
    const delta = diffCatalog(before, after);
    const runId = await writeRefreshRun(client, {
      clinicId, trigger: "cli", status: "saved",
      servicesBefore: before.services.length, servicesAfter: after.services.length,
      startedAt: new Date(),
    });
    const written = await writeCatalogChanges(client, runId, clinicId, delta);
    return { runId, delta, written };
  });
}

/** Size of the PUBLIC taxonomy — what the closed-catalog gate must hold fixed. */
async function catalogSize(): Promise<{ services: number; concerns: number }> {
  const r = await queryOne<{ services: number; concerns: number }>(
    `SELECT (SELECT count(*) FROM services WHERE is_active)::int AS services,
            (SELECT count(*) FROM concerns WHERE is_active)::int AS concerns`
  );
  return r!;
}

async function main() {
  await query(`DELETE FROM clinics WHERE slug = $1`, [SLUG]);
  const clinic = await queryOne<{ id: string }>(
    `INSERT INTO clinics (name, slug, website, is_active)
     VALUES ('ZZ Refresh E2E Fixture', $1, 'https://zz-refresh-e2e.invalid', true)
     RETURNING id`,
    [SLUG]
  );
  if (!clinic) throw new Error("could not seed fixture clinic");
  const clinicId = clinic.id;
  const catalogBefore = await catalogSize();
  const startedAt = new Date();

  const svc = (name: string): SaveService => ({ raw_name: name, general_name: name });
  /**
   * A row the resolver cannot place: no general_name to match or create from, and
   * a raw name nothing in the catalog is close to. Must be dropped, never stored.
   */
  const unresolvable = (name: string): SaveService => ({ raw_name: name, general_name: null });
  const runCount = async () =>
    Number((await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM clinic_refresh_runs WHERE clinic_id = $1`, [clinicId]
    ))[0].n);
  const activeRaw = async () =>
    (await query<{ raw_name: string; match_status: string; service_id: string | null }>(
      `SELECT raw_name, match_status, service_id FROM clinic_services
        WHERE clinic_id = $1 ORDER BY raw_name`,
      [clinicId]
    ));

  try {
    // ── 2a. first import: a run row, but no change rows ────────────────────
    console.log("\nfirst import");
    const first = await refresh(clinicId, [svc("Botox"), svc("Microneedling"), svc("Kybella")]);
    check("run row written", (await runCount()) === 1);
    check("zero change rows on a first import", first.written === 0, `wrote ${first.written}`);

    // ── 2b. identical re-run: no changes ───────────────────────────────────
    console.log("\nidentical re-run");
    const second = await refresh(clinicId, [svc("Botox"), svc("Microneedling"), svc("Kybella")]);
    check("zero change rows when nothing changed", second.written === 0, `wrote ${second.written}`);

    // ── 2c. a real removal is logged exactly once ──────────────────────────
    console.log("\none treatment disappears from the site");
    const third = await refresh(clinicId, [svc("Botox"), svc("Microneedling")]);
    check("one removal logged", third.delta.removed.length === 1, JSON.stringify(third.delta.removed));
    check("no spurious additions", third.delta.added.length === 0, JSON.stringify(third.delta.added));

    // ── 1. junk is never stored ────────────────────────────────────────────
    console.log("\nsite lists a phone number and an address among its 'services'");
    const junk = ["385-354-SEGO", "401 West 500 South Bountiful", "Zzq Widget Xyzzy"];
    const r = await refresh(clinicId, [
      svc("Botox"),
      svc("Microneedling"),
      ...junk.map(unresolvable),
    ]);
    const stored = await activeRaw();
    check(
      "unresolvable names not stored",
      junk.every((j) => !stored.some((row) => row.raw_name === j)),
      stored.map((x) => x.raw_name).join(", ")
    );
    check("real treatments still stored", stored.length === 2, `${stored.length} rows`);
    check("no dangling service_id", stored.every((x) => x.service_id !== null));
    check("junk logged as no-op, not as changes", r.written === 0, `wrote ${r.written}`);

    // ── 5. a retired name lands on the core entry that absorbed it ─────────
    // "Morpheus8" is one of the 543 names in LEGACY_TREATMENT_REDIRECT. Before
    // the reduction it was its own row; the closed catalog must place it on RF
    // Microneedling rather than drop it — that redirect coverage is the reason
    // closing the catalog does not gut the directory.
    console.log("\nsite lists a retired brand name");
    await refresh(clinicId, [svc("Botox"), svc("Morpheus8")]);
    const redirected = await queryOne<{ slug: string }>(
      `SELECT s.slug FROM clinic_services cs JOIN services s ON s.id = cs.service_id
        WHERE cs.clinic_id = $1 AND cs.raw_name = 'Morpheus8'`,
      [clinicId]
    );
    check("retired brand resolves via the redirect map", redirected?.slug === "rf-microneedling",
      redirected ? `-> ${redirected.slug}` : "dropped");

    // ── 5b. the concern resolver obeys the same rule ───────────────────────
    // The concern path is not reachable from `refresh()` (it needs a crawl and
    // an AI call), so drive its resolver directly — it is the other half of
    // defect 6 and mints `origin='ai'` concerns rows the same way.
    console.log("\nconcern resolution under a closed catalog");
    const cCat = await loadConcernCatalog();
    const created: string[] = [];
    const resolveC = (n: string) => resolveConcernRow(cCat, created, n);
    check("retired concern redirects", (await resolveC("Hyperpigmentation"))?.slug === "pigmentation");
    check("retired concern redirects (2)", (await resolveC("Bunny Lines"))?.slug === "wrinkles");
    check("unknown concern is dropped, not minted", (await resolveC("Zzq Widget Xyzzy")) === null);
    check("resolver reported no creations", created.length === 0, created.join(", "));

    // ── 4. the catalog is CLOSED ───────────────────────────────────────────
    // Every name above that the catalog could not place must have been dropped,
    // never minted. This is the guard for defect 6.
    console.log("\nclosed-catalog invariant");
    const catalogNow = await catalogSize();
    check("no active services row was created", catalogNow.services === catalogBefore.services,
      `${catalogBefore.services} -> ${catalogNow.services}`);
    check("no active concerns row was created", catalogNow.concerns === catalogBefore.concerns,
      `${catalogBefore.concerns} -> ${catalogNow.concerns}`);

    // ── 6. website-verified rows survive an overwrite ──────────────────────
    // apply-verdicts.ts writes human-gated rows as "<Core Name> (verified)".
    // An automated overwrite must leave them alone.
    console.log("\noverwrite refresh with a website-verified row present");
    const botox = await queryOne<{ id: string }>(`SELECT id FROM services WHERE slug = 'botox'`);
    await query(
      `INSERT INTO clinic_services (clinic_id, service_id, raw_name, match_status)
       VALUES ($1, $2, 'Botox (verified)', 'matched')
       ON CONFLICT (clinic_id, raw_name) DO NOTHING`,
      [clinicId, botox!.id]
    );
    await refresh(clinicId, [svc("Microneedling")]);
    const survived = await queryOne<{ raw_name: string }>(
      `SELECT raw_name FROM clinic_services WHERE clinic_id = $1 AND raw_name = 'Botox (verified)'`,
      [clinicId]
    );
    check("verified row survived the overwrite", survived !== null);
    check("the scraped menu was still replaced",
      (await activeRaw()).some((r) => r.raw_name === "Microneedling"));

    // ── 3. the save is atomic ──────────────────────────────────────────────
    console.log("\nthrow mid-transaction");
    const menuBefore = (await activeRaw()).map((r) => r.raw_name).join("|");
    const runsBefore = await runCount();
    let threw = false;
    try {
      await withTransaction(async (client) => {
        await saveClinicServices(clinicId, [svc("Only One Left")], { overwrite: true, client });
        throw new Error("simulated mid-save failure");
      });
    } catch {
      threw = true;
    }
    check("the throw propagated", threw);
    check("menu unchanged", (await activeRaw()).map((r) => r.raw_name).join("|") === menuBefore);
    check("no run row written", (await runCount()) === runsBefore);
  } finally {
    await query(`DELETE FROM clinics WHERE id = $1`, [clinicId]);
    // If the closed-catalog gate ever regresses, this run will have minted
    // catalog rows — check 4 above reports that as a failure, and this retires
    // them so a failing test does not leave the public taxonomy polluted.
    // Retired, not deleted: the 2026-09-06 reduction's convention, and the rows
    // may already be referenced by clinic_services elsewhere.
    const leaked = await query<{ kind: string; slug: string }>(
      `WITH s AS (
         UPDATE services SET is_active = false, updated_at = NOW()
          WHERE is_active AND origin = 'ai' AND created_at > $1 RETURNING slug
       ), c AS (
         UPDATE concerns SET is_active = false, updated_at = NOW()
          WHERE is_active AND origin = 'ai' AND created_at > $1 RETURNING slug
       )
       SELECT 'service' AS kind, slug FROM s
       UNION ALL SELECT 'concern', slug FROM c`,
      [startedAt]
    );
    for (const l of leaked) console.log(`  ! retired leaked ${l.kind} "${l.slug}"`);
  }

  console.log(failures === 0 ? "\n✓ all checks passed" : `\n✗ ${failures} check(s) failed`);
  await pool.end();
  if (failures > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error("✗ test-refresh-e2e failed:", err);
  await pool.end();
  process.exit(1);
});
