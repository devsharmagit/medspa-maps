/**
 * test-rescrape-serve.ts — helper for the HTTP/cron integration test.
 *
 * Starts a persistent fake medspa site on a fixed port and seeds ONE test
 * clinic pointing at it, marked as the stalest clinic in the DB so a capped
 * cron run (RESCRAPE_LIMIT=1) targets exactly this clinic and never scrapes a
 * real external site. Prints the clinic id, then stays alive until killed.
 *
 *   bun scripts/test-rescrape-serve.ts          # serve + seed, keep running
 *   bun scripts/test-rescrape-serve.ts --cleanup
 */

import { createServer } from "node:http";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const PORT = 4599;
const TEST_NAME = "ZZZ E2E Rescrape HTTP Clinic";
const TEST_SLUG = "zzz-e2e-rescrape-http-clinic";

const FIXTURE_HTML = `<!doctype html><html><head><title>${TEST_NAME}</title></head>
<body><header><nav>
  <a href="/">Home</a>
  <a href="/services/botox/">Botox</a>
  <a href="/services/dermal-fillers/">Dermal Fillers</a>
  <a href="/services/microneedling/">Microneedling</a>
</nav></header><main><h1>Welcome</h1></main></body></html>`;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function cleanup() {
  const c = await pool.query<{ id: string; business_id: string }>(
    "SELECT id, business_id FROM clinics WHERE slug = $1",
    [TEST_SLUG]
  );
  for (const row of c.rows) {
    await pool.query("DELETE FROM clinics WHERE id = $1", [row.id]);
    await pool.query("DELETE FROM businesses WHERE id = $1 AND name = $2", [
      row.business_id,
      TEST_NAME,
    ]);
  }
}

async function main() {
  if (process.argv.includes("--cleanup")) {
    await cleanup();
    console.log("cleaned up HTTP test clinic");
    await pool.end();
    process.exit(0);
  }

  await cleanup();

  const biz = await pool.query<{ id: string }>(
    `INSERT INTO businesses (name, data_source) VALUES ($1,'scraped') RETURNING id`,
    [TEST_NAME]
  );
  const clinic = await pool.query<{ id: string }>(
    `INSERT INTO clinics (business_id, name, slug, website, data_source, is_active, last_scraped_at)
     VALUES ($1,$2,$3,$4,'scraped',true,'1970-01-01T00:00:00Z') RETURNING id`,
    [biz.rows[0].id, TEST_NAME, TEST_SLUG, `http://127.0.0.1:${PORT}`]
  );
  const clinicId = clinic.rows[0].id;

  const svc = await pool.query<{ id: string; slug: string }>(
    `SELECT id, slug FROM services WHERE slug IN ('botox','coolsculpting')`
  );
  const idBySlug = new Map(svc.rows.map((r) => [r.slug, r.id]));
  for (const [raw, slug] of [["Botox", "botox"], ["CoolSculpting", "coolsculpting"]] as const) {
    await pool.query(
      `INSERT INTO clinic_services
         (clinic_id, service_id, raw_name, match_status, match_confidence, data_source, is_active, last_scraped_at)
       VALUES ($1,$2,$3,'matched',1,'scraped',true,NOW())`,
      [clinicId, idBySlug.get(slug), raw]
    );
  }

  const server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(FIXTURE_HTML);
  });
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`FIXTURE_READY port=${PORT} clinicId=${clinicId}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
