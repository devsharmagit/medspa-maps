// Apply a fixed set of verified g99 id backfills (redirect-verified rebrand matches) to Neon + RDS.
// Each pair was confirmed by following the G99 clinic's old domain and seeing it redirect to our clinic's domain.
// Usage: node scripts/apply-g99-backfill-batch.mjs           # dry run
//        node scripts/apply-g99-backfill-batch.mjs --apply    # Neon
//        node scripts/apply-g99-backfill-batch.mjs --apply --rds   # Neon + RDS (RDS_URL env)
import { Pool } from "pg";
import { execSync } from "node:child_process";

const APPLY = process.argv.includes("--apply");
const RDS = process.argv.includes("--rds");
const stripSsl = s => s.replace(/[?&]sslmode=[^&]*/gi, "").replace(/[?&]channel_binding=[^&]*/gi, "");
const readEnv = k => stripSsl(execSync(`grep -m1 '^${k}=' ${import.meta.dirname}/../.env | sed 's/^${k}=//' | tr -d '"'`).toString().trim());
const NEON = readEnv("DATABASE_URL");
const RDS_URL = process.env.RDS_URL ? stripSsl(process.env.RDS_URL) : null;

// our_clinic_uuid, g99_clinic_id, g99_business_id, label
const PAIRS = [
  ["8af16be8-319a-4f0f-8971-30c36730a2e6", 4978, 4716, "Lush Lifestyle Medicine"],
  ["470f92fa-277d-44f8-bd9b-ca8d4777ad4c", 4851, 4608, "The Derm Collective North Shore"],
  ["836d65c5-0373-4688-97a2-3cec436d6bdd", 1400, 1351, "EMME Skin Studio"],
  ["ea4115f5-f4fb-440b-9e7b-2599afa3ccdd", 4456, 4264, "The District"],
  ["85028310-9bef-4ea0-87fb-20875f10599e", 546, 499, "OC Cosmetic and Vein Center"],
  ["22f93a43-d111-44d6-aea3-b88bdc1e4f40", 4301, 4123, "Rava Medical"],
  ["a47c4be7-d35f-4c50-9d30-8c0039195e7a", 1762, 1749, "Reclaim Med Spa"],
  ["a8f15871-f9b6-459b-bf09-0f666f3a1f0c", 179, 168, "VIBE Aesthetics and Wellness"],
];

const neon = new Pool({ connectionString: NEON, ssl: { rejectUnauthorized: false } });

async function run(pool, label) {
  const client = await pool.connect();
  let n = 0;
  try {
    await client.query("BEGIN");
    for (const [id, cid, bid] of PAIRS) {
      const res = await client.query(
        `UPDATE clinics SET g99_clinic_id=COALESCE($2::bigint,g99_clinic_id),
           g99_business_id=COALESCE($3::bigint,g99_business_id),
           g99_tenant_id=COALESCE($3::bigint,g99_tenant_id), last_synced_at=NOW()
         WHERE id=$1::uuid AND g99_clinic_id IS NULL`, [id, cid, bid]);
      n += res.rowCount;
    }
    await client.query("COMMIT");
    console.log(`[${label}] rows updated: ${n}`);
  } catch (e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); }
}

console.log(`Pairs to apply: ${PAIRS.length}`);
for (const [id, cid, bid, label] of PAIRS) console.log(`  ${label}: clinic ${cid} / business ${bid}`);
if (!APPLY) { console.log("\nDRY RUN — pass --apply to write."); await neon.end(); process.exit(0); }

await run(neon, "NEON");
if (RDS) {
  if (!RDS_URL) console.log("[RDS] RDS_URL not set — skipped.");
  else { const rds = new Pool({ connectionString: RDS_URL, ssl: { rejectUnauthorized: false } }); await run(rds, "RDS"); await rds.end(); }
}
await neon.end();
console.log("Done.");
