/**
 * test-rescrape-e2e.ts — end-to-end test for the daily treatment re-scrape.
 *
 *   bun scripts/test-rescrape-e2e.ts            # run the test (self-cleans)
 *   bun scripts/test-rescrape-e2e.ts --keep     # leave test data for UI checks
 *   bun scripts/test-rescrape-e2e.ts --cleanup  # delete leftover test data
 *
 * It stands up a fake medspa website (a local HTTP server), seeds a clinic that
 * currently offers {Botox, CoolSculpting}, points it at the fake site (which
 * advertises {Botox, Dermal Fillers, Microneedling}), then runs the REAL
 * rescrapeClinic() code path and asserts:
 *   - added   = dermal-fillers, microneedling
 *   - removed = coolsculpting
 *   - botox   = unchanged
 *   - clinic_services reflects the new active set (coolsculpting soft-deleted)
 *   - clinic_service_changes has exactly the 3 expected rows
 *   - a second run is idempotent (no new changes)
 */

import { createServer, type Server } from "node:http";
import { Pool } from "pg";
import * as dotenv from "dotenv";
import { rescrapeClinic } from "@/lib/rescrape/rescrape-clinic";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const TEST_NAME = "ZZZ E2E Rescrape Test Clinic";
const TEST_SLUG = "zzz-e2e-rescrape-test-clinic";

// A fake medspa homepage advertising Botox / Dermal Fillers / Microneedling.
const FIXTURE_HTML = `<!doctype html><html><head><title>${TEST_NAME}</title></head>
<body>
  <header>
    <nav>
      <a href="/">Home</a>
      <a href="/services/botox/">Botox</a>
      <a href="/services/dermal-fillers/">Dermal Fillers</a>
      <a href="/services/microneedling/">Microneedling</a>
      <a href="/contact/">Contact</a>
    </nav>
  </header>
  <main><h1>Welcome</h1></main>
</body></html>`;

let ok = true;
function check(label: string, cond: boolean, detail = "") {
  const mark = cond ? "✓" : "✗";
  if (!cond) ok = false;
  console.log(`  ${mark} ${label}${detail ? ` — ${detail}` : ""}`);
}

function setEq(a: string[], b: string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
}

async function cleanup() {
  // Deleting the clinic cascades clinic_services / clinic_service_changes /
  // scrape_jobs. Then remove the parent business.
  const clinic = await pool.query<{ id: string; business_id: string }>(
    "SELECT id, business_id FROM clinics WHERE slug = $1",
    [TEST_SLUG]
  );
  for (const row of clinic.rows) {
    await pool.query("DELETE FROM clinics WHERE id = $1", [row.id]);
    await pool.query(
      "DELETE FROM businesses WHERE id = $1 AND name = $2",
      [row.business_id, TEST_NAME]
    );
  }
}

async function seedClinic(website: string): Promise<string> {
  const biz = await pool.query<{ id: string }>(
    `INSERT INTO businesses (name, data_source) VALUES ($1, 'scraped') RETURNING id`,
    [TEST_NAME]
  );
  const businessId = biz.rows[0].id;

  const clinic = await pool.query<{ id: string }>(
    `INSERT INTO clinics (business_id, name, slug, website, data_source, is_active, last_scraped_at)
     VALUES ($1, $2, $3, $4, 'scraped', true, NULL) RETURNING id`,
    [businessId, TEST_NAME, TEST_SLUG, website]
  );
  const clinicId = clinic.rows[0].id;

  // Current offerings: Botox (stays) + CoolSculpting (will be removed).
  const svc = await pool.query<{ id: string; slug: string }>(
    `SELECT id, slug FROM services WHERE slug IN ('botox', 'coolsculpting')`
  );
  const idBySlug = new Map(svc.rows.map((r) => [r.slug, r.id]));
  const seed: Array<[string, string]> = [
    ["Botox", "botox"],
    ["CoolSculpting", "coolsculpting"],
  ];
  for (const [raw, slug] of seed) {
    await pool.query(
      `INSERT INTO clinic_services
         (clinic_id, service_id, raw_name, match_status, match_confidence, data_source, is_active, last_scraped_at)
       VALUES ($1, $2, $3, 'matched', 1, 'scraped', true, NOW())`,
      [clinicId, idBySlug.get(slug), raw]
    );
  }
  return clinicId;
}

async function activeCanonical(clinicId: string): Promise<string[]> {
  const r = await pool.query<{ slug: string }>(
    `SELECT DISTINCT s.slug
       FROM clinic_services cs JOIN services s ON s.id = cs.service_id
      WHERE cs.clinic_id = $1 AND cs.is_active = true
      ORDER BY s.slug`,
    [clinicId]
  );
  return r.rows.map((x) => x.slug);
}

async function changeRows(clinicId: string) {
  const r = await pool.query<{ service_slug: string; change_type: string }>(
    `SELECT service_slug, change_type FROM clinic_service_changes
      WHERE clinic_id = $1 ORDER BY change_type, service_slug`,
    [clinicId]
  );
  return r.rows;
}

async function main() {
  if (process.argv.includes("--cleanup")) {
    await cleanup();
    console.log("Cleaned up E2E test data.");
    await pool.end();
    process.exit(0);
  }

  // Fresh start
  await cleanup();

  // ── fixture web server ──────────────────────────────────────────────────────
  const server: Server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(FIXTURE_HTML);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const website = `http://127.0.0.1:${port}`;
  console.log(`Fixture medspa site at ${website}`);

  try {
    const clinicId = await seedClinic(website);
    console.log(`Seeded clinic ${clinicId} offering [botox, coolsculpting]\n`);

    // ── RUN 1 ─────────────────────────────────────────────────────────────────
    console.log("Run 1 — re-scrape:");
    const r1 = await rescrapeClinic(clinicId);
    check("scrape ok", r1.ok, r1.error ?? "");
    check("pages visited > 0", r1.pagesVisited > 0, `${r1.pagesVisited}`);
    check(
      "added = [dermal-fillers, microneedling]",
      setEq(r1.added.map((a) => a.slug), ["dermal-fillers", "microneedling"]),
      r1.added.map((a) => a.slug).join(",")
    );
    check(
      "removed = [coolsculpting]",
      setEq(r1.removed.map((a) => a.slug), ["coolsculpting"]),
      r1.removed.map((a) => a.slug).join(",")
    );

    const active1 = await activeCanonical(clinicId);
    check(
      "active set = [botox, dermal-fillers, microneedling]",
      setEq(active1, ["botox", "dermal-fillers", "microneedling"]),
      active1.join(",")
    );

    const coolInactive = await pool.query<{ is_active: boolean }>(
      `SELECT cs.is_active FROM clinic_services cs JOIN services s ON s.id = cs.service_id
        WHERE cs.clinic_id = $1 AND s.slug = 'coolsculpting'`,
      [clinicId]
    );
    check(
      "coolsculpting row soft-deleted (is_active=false)",
      coolInactive.rows.length === 1 && coolInactive.rows[0].is_active === false
    );

    const rows1 = await changeRows(clinicId);
    const added1 = rows1.filter((r) => r.change_type === "added").map((r) => r.service_slug);
    const removed1 = rows1.filter((r) => r.change_type === "removed").map((r) => r.service_slug);
    check("change log: 3 rows", rows1.length === 3, `${rows1.length}`);
    check("change log added", setEq(added1, ["dermal-fillers", "microneedling"]), added1.join(","));
    check("change log removed", setEq(removed1, ["coolsculpting"]), removed1.join(","));

    // ── RUN 2 — idempotency ─────────────────────────────────────────────────────
    console.log("\nRun 2 — re-scrape again (idempotent):");
    const r2 = await rescrapeClinic(clinicId);
    check("no new added", r2.added.length === 0, r2.added.map((a) => a.slug).join(","));
    check("no new removed", r2.removed.length === 0, r2.removed.map((a) => a.slug).join(","));
    const rows2 = await changeRows(clinicId);
    check("change log still 3 rows (no churn)", rows2.length === 3, `${rows2.length}`);

    // ── scrape_jobs recorded ────────────────────────────────────────────────────
    const jobs = await pool.query<{ status: string }>(
      `SELECT status FROM scrape_jobs WHERE clinic_id = $1 AND job_type = 'rescrape'`,
      [clinicId]
    );
    check("scrape_jobs recorded (2 completed)", jobs.rows.filter((j) => j.status === "completed").length === 2, `${jobs.rows.length} jobs`);

    console.log("");
    if (process.argv.includes("--keep")) {
      console.log(`Kept test data (clinic ${clinicId}). Run with --cleanup to remove.`);
    } else {
      await cleanup();
      console.log("Cleaned up test data.");
    }
  } finally {
    server.close();
  }

  console.log(ok ? "\n✅ E2E PASSED" : "\n❌ E2E FAILED");
  await pool.end();
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error("E2E crashed:", err);
  process.exit(1);
});
