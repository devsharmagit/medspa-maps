// Deactivate 4 clinics on Neon + RDS. Aère also gets its G99 ids attached.
// Usage: node scripts/deactivate-four.mjs --apply [--rds]   (RDS needs RDS_URL env)
import { Pool } from "pg";
import { execSync } from "node:child_process";

const APPLY = process.argv.includes("--apply");
const RDS = process.argv.includes("--rds");
const stripSsl = s => s.replace(/[?&]sslmode=[^&]*/gi, "").replace(/[?&]channel_binding=[^&]*/gi, "");
const readEnv = k => stripSsl(execSync(`grep -m1 '^${k}=' ${import.meta.dirname}/../.env | sed 's/^${k}=//' | tr -d '"'`).toString().trim());
const NEON = readEnv("DATABASE_URL");
const RDS_URL = process.env.RDS_URL ? stripSsl(process.env.RDS_URL) : null;

const AERE = "66a73c95-b674-4a4b-ba70-17e6cb100aa6";
const DEACTIVATE = [
  AERE,                                    // Aère Aesthetics (+ ids)
  "a25c20a2-6cda-44a1-9c95-d1a69c2c28d0",  // Cienega Medical
  "31c448e5-b76d-446c-a13f-853b718476cf",  // Balanced Wellness Medical Spa
  "1dc165da-0171-409b-8bb6-df490501db28",  // Essence Skin Clinic
];

const neon = new Pool({ connectionString: NEON, ssl: { rejectUnauthorized: false } });

async function run(pool, label) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // attach Aère's g99 ids (only if still missing) + deactivate it
    const a = await client.query(
      `UPDATE clinics SET g99_clinic_id=COALESCE($2::bigint,g99_clinic_id),
         g99_business_id=COALESCE($3::bigint,g99_business_id),
         g99_tenant_id=COALESCE($3::bigint,g99_tenant_id),
         is_active=false, last_synced_at=NOW(), updated_at=NOW()
       WHERE id=$1::uuid`, [AERE, 4700, 4462]);
    // deactivate the other three
    const d = await client.query(
      `UPDATE clinics SET is_active=false, updated_at=NOW()
       WHERE id = ANY($1::uuid[]) AND is_active=true`, [DEACTIVATE.slice(1)]);
    await client.query("COMMIT");
    console.log(`[${label}] aere updated: ${a.rowCount}, others deactivated: ${d.rowCount}`);
    try { await client.query("REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view"); console.log(`[${label}] matview refreshed`); }
    catch (e) { console.log(`[${label}] matview refresh skipped: ${e.message}`); }
  } catch (e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); }
}

if (!APPLY) { console.log("DRY RUN — pass --apply. Would deactivate 4 clinics (Aère + Cienega + Balanced + Essence) and attach Aère g99 4700/4462."); await neon.end(); process.exit(0); }

await run(neon, "NEON");
if (RDS) {
  if (!RDS_URL) console.log("[RDS] RDS_URL not set — skipped.");
  else { const rds = new Pool({ connectionString: RDS_URL, ssl: { rejectUnauthorized: false } }); await run(rds, "RDS"); await rds.end(); }
}
await neon.end();
console.log("Done.");
