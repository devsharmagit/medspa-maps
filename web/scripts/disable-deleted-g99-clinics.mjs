// Deactivate (is_active=false) our clinics whose linked G99 business is deleted=true.
// Authoritative signal per G99 team: businesses.deleted = true.
// Usage:
//   node scripts/disable-deleted-g99-clinics.mjs            # dry run (report only)
//   node scripts/disable-deleted-g99-clinics.mjs --apply    # write to Neon (DATABASE_URL)
//   node scripts/disable-deleted-g99-clinics.mjs --apply --rds   # also write to RDS (needs RDS_URL env)
// Requires the SSH tunnel to G99 prod on localhost:5435 (and :15432 for --rds).
import { Pool } from "pg";
import { execSync } from "node:child_process";
import fs from "node:fs";

const APPLY = process.argv.includes("--apply");
const RDS = process.argv.includes("--rds");
const stripSsl = s => s.replace(/[?&]sslmode=[^&]*/gi, "").replace(/[?&]channel_binding=[^&]*/gi, "");

const readEnv = k => stripSsl(execSync(`grep -m1 '^${k}=' ${import.meta.dirname}/../.env | sed 's/^${k}=//' | tr -d '"'`).toString().trim());
const NEON = readEnv("DATABASE_URL");
// G99 prod reader, reached via the SSH tunnel on localhost:5435 (see G99_PROD_DATABASE_URL in .env).
const G99 = readEnv("G99_PROD_DATABASE_URL");
const RDS_URL = process.env.RDS_URL ? stripSsl(process.env.RDS_URL) : null;

const neon = new Pool({ connectionString: NEON, ssl: { rejectUnauthorized: false } });
const g99 = new Pool({ connectionString: G99, ssl: { rejectUnauthorized: false } });

// Our G99-linked clinics (target set is independent of is_active, so a second
// run can mirror the change onto another DB even after the first was applied).
const ours = (await neon.query(
  `SELECT id, name, slug, is_active, g99_business_id
     FROM clinics WHERE g99_business_id IS NOT NULL`
)).rows;
const bizIds = [...new Set(ours.map(r => r.g99_business_id))];

// Which of those businesses are deleted=true in G99 prod.
const deletedBiz = new Set(
  (await g99.query(`SELECT id FROM businesses WHERE id = ANY($1::bigint[]) AND deleted IS TRUE`, [bizIds]))
    .rows.map(r => String(r.id))
);

const targets = ours.filter(r => deletedBiz.has(String(r.g99_business_id)));
console.log(`Active G99-linked clinics: ${ours.length}`);
console.log(`Businesses deleted=true among them: ${deletedBiz.size}`);
console.log(`Clinics to deactivate: ${targets.length}`);
for (const t of targets) console.log(`  - ${t.name}  [${t.slug}]  clinic=${t.id}  biz=${t.g99_business_id}`);

// audit record
const ts = new Date().toISOString().slice(0, 10);
const reportDir = `${import.meta.dirname}/../reports`;
fs.mkdirSync(reportDir, { recursive: true });
const csv = ["clinic_id,name,slug,g99_business_id",
  ...targets.map(t => `${t.id},"${(t.name||"").replace(/"/g,'""')}",${t.slug},${t.g99_business_id}`)].join("\n");
fs.writeFileSync(`${reportDir}/disabled-g99-deleted-${ts}.csv`, csv + "\n");

if (!APPLY) {
  console.log("\nDRY RUN — no changes written. Re-run with --apply to deactivate.");
  await neon.end(); await g99.end();
  process.exit(0);
}

const ids = targets.map(t => t.id);
async function disableOn(pool, label) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const res = await client.query(
      `UPDATE clinics SET is_active = false, updated_at = NOW() WHERE id = ANY($1::uuid[]) AND is_active = true`, [ids]);
    await client.query("COMMIT");
    console.log(`[${label}] rows deactivated: ${res.rowCount}`);
    try { await client.query("REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view"); console.log(`[${label}] matview refreshed`); }
    catch (e) { console.log(`[${label}] matview refresh skipped: ${e.message}`); }
  } catch (e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); }
}

if (ids.length === 0) { console.log("Nothing to do."); await neon.end(); await g99.end(); process.exit(0); }

await disableOn(neon, "NEON");

if (RDS) {
  if (!RDS_URL) { console.log("[RDS] RDS_URL env not set — skipped. Provide RDS_URL to mirror the change."); }
  else {
    const rds = new Pool({ connectionString: RDS_URL, ssl: { rejectUnauthorized: false } });
    await disableOn(rds, "RDS");
    await rds.end();
  }
}
await neon.end(); await g99.end();
console.log("Done.");
