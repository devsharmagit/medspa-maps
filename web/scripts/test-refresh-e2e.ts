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
 *
 * Cleans up after itself (the clinic delete cascades to every child row).
 */

import pool, { query, queryOne, withTransaction } from "../src/lib/db";
import { saveClinicServices, type SaveService } from "../src/lib/admin/clinic-save";
import { readCatalogSnapshot, writeCatalogChanges, writeRefreshRun } from "../src/lib/ingest/change-log";
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
    // Fixture-only catalog rows the save may have minted.
    await query(
      `DELETE FROM services WHERE origin = 'ai' AND name IN ('Only One Left')`
    );
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
