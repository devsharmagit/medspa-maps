// Backfill g99_clinic_id / g99_business_id / g99_tenant_id on clinics that lack them,
// by matching the clinic's website host to a live G99 prod clinic (exact host, non-deleted).
// Usage:
//   node scripts/backfill-g99-ids-by-website.mjs            # dry run (report only)
//   node scripts/backfill-g99-ids-by-website.mjs --apply    # write to Neon (DATABASE_URL)
//   node scripts/backfill-g99-ids-by-website.mjs --apply --rds   # also write to RDS (needs RDS_URL env)
// Requires the SSH tunnel to G99 prod on localhost:5435 (and :15432 for --rds).
import { Pool } from "pg";
import { execSync } from "node:child_process";
import fs from "node:fs";

const APPLY = process.argv.includes("--apply");
const RDS = process.argv.includes("--rds");
const stripSsl = s => s.replace(/[?&]sslmode=[^&]*/gi, "").replace(/[?&]channel_binding=[^&]*/gi, "");
const readEnv = k => stripSsl(execSync(`grep -m1 '^${k}=' ${import.meta.dirname}/../.env | sed 's/^${k}=//' | tr -d '"'`).toString().trim());

const NEON = readEnv("DATABASE_URL");
const G99 = readEnv("G99_PROD_DATABASE_URL"); // via tunnel :5435
const RDS_URL = process.env.RDS_URL ? stripSsl(process.env.RDS_URL) : null;

// Identical host normalization to app's websiteDomain() (clinic-save.ts): strip scheme, www., path; lowercase.
const host = url => {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase() || null;
  }
};
const HOST_SQL = `regexp_replace(regexp_replace(regexp_replace(lower(website),'^https?://',''),'^www\\.',''),'[/?#].*$','')`;

const neon = new Pool({ connectionString: NEON, ssl: { rejectUnauthorized: false } });
const g99 = new Pool({ connectionString: G99, ssl: { rejectUnauthorized: false } });

// 1) our clinics missing the ids, with a website
const missing = (await neon.query(
  `SELECT id, name, website FROM clinics WHERE g99_clinic_id IS NULL AND website IS NOT NULL AND website <> ''`
)).rows.map(r => ({ ...r, domain: host(r.website) })).filter(r => r.domain);
const domains = [...new Set(missing.map(r => r.domain))];

// 2) authoritative match: exact host, non-deleted clinic under a non-deleted/undeleted business
const clean = (await g99.query(
  `SELECT id AS clinic_id, tenant_id AS business_id, ${HOST_SQL} AS host
     FROM clinics
    WHERE deleted IS NOT TRUE
      AND website IS NOT NULL AND website <> ''
      AND ${HOST_SQL} = ANY($1::text[])
      AND tenant_id IN (SELECT id FROM businesses WHERE delete_business IS NOT TRUE AND deleted IS NOT TRUE)
    ORDER BY id`, [domains]
)).rows;
// domain -> {clinic_id, business_id}; if >1, keep lowest id (already ordered) and count dupes
const cleanMap = new Map();
const dupes = new Map();
for (const r of clean) {
  if (cleanMap.has(r.host)) { dupes.set(r.host, (dupes.get(r.host) || 1) + 1); continue; }
  cleanMap.set(r.host, { clinic_id: r.clinic_id, business_id: r.business_id });
}

// 3) secondary: any host match at all (incl. deleted) for the review CSV
const anyMatch = (await g99.query(
  `SELECT id AS clinic_id, tenant_id AS business_id, deleted, ${HOST_SQL} AS host
     FROM clinics WHERE website IS NOT NULL AND website <> '' AND ${HOST_SQL} = ANY($1::text[])`, [domains]
)).rows;
const anyMap = new Map();
for (const r of anyMatch) if (!anyMap.has(r.host)) anyMap.set(r.host, r);

// classify
const rows = missing.map(m => {
  const c = cleanMap.get(m.domain);
  if (c) return { ...m, decision: "link", clinic_id: c.clinic_id, business_id: c.business_id };
  const a = anyMap.get(m.domain);
  if (a) return { ...m, decision: a.deleted ? "review-deleted" : "review-other", clinic_id: a.clinic_id, business_id: a.business_id };
  return { ...m, decision: "no-match", clinic_id: null, business_id: null };
});
const links = rows.filter(r => r.decision === "link");
const review = rows.filter(r => r.decision.startsWith("review"));
const nomatch = rows.filter(r => r.decision === "no-match");

console.log(`missing-id clinics: ${missing.length}`);
console.log(`  link (clean):     ${links.length}`);
console.log(`  review:           ${review.length}`);
console.log(`  no-match:         ${nomatch.length}`);
for (const r of links) console.log(`  LINK   ${r.name} [${r.domain}] -> clinic=${r.clinic_id} biz=${r.business_id}`);
for (const r of review) console.log(`  REVIEW ${r.name} [${r.domain}] (${r.decision}) g99_clinic=${r.clinic_id} biz=${r.business_id}`);
if (dupes.size) console.log(`  NOTE multi-clinic hosts (took lowest id): ${[...dupes.keys()].join(", ")}`);

// report CSV
const ts = new Date().toISOString().slice(0, 10);
const reportDir = `${import.meta.dirname}/../reports`;
fs.mkdirSync(reportDir, { recursive: true });
const esc = v => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = ["our_clinic_id,name,domain,decision,g99_clinic_id,g99_business_id",
  ...rows.sort((a,b)=>a.decision.localeCompare(b.decision)||(a.name||"").localeCompare(b.name||""))
    .map(r => [r.id, r.name, r.domain, r.decision, r.clinic_id, r.business_id].map(esc).join(","))].join("\n");
fs.writeFileSync(`${reportDir}/backfill-g99-ids-${ts}.csv`, csv + "\n");
console.log(`CSV -> reports/backfill-g99-ids-${ts}.csv`);

if (!APPLY) {
  console.log("\nDRY RUN — no changes written. Re-run with --apply.");
  await neon.end(); await g99.end(); process.exit(0);
}
if (links.length === 0) { console.log("Nothing to link."); await neon.end(); await g99.end(); process.exit(0); }

async function applyOn(pool, label) {
  const client = await pool.connect();
  let n = 0;
  try {
    await client.query("BEGIN");
    for (const r of links) {
      const res = await client.query(
        `UPDATE clinics SET
           g99_clinic_id   = COALESCE($2::bigint, g99_clinic_id),
           g99_business_id = COALESCE($3::bigint, g99_business_id),
           g99_tenant_id   = COALESCE($3::bigint, g99_tenant_id),
           last_synced_at  = NOW()
         WHERE id = $1 AND g99_clinic_id IS NULL`,
        [r.id, r.clinic_id, r.business_id]);
      n += res.rowCount;
    }
    await client.query("COMMIT");
    console.log(`[${label}] rows updated: ${n}`);
  } catch (e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); }
}

await applyOn(neon, "NEON");
if (RDS) {
  if (!RDS_URL) console.log("[RDS] RDS_URL env not set — skipped.");
  else { const rds = new Pool({ connectionString: RDS_URL, ssl: { rejectUnauthorized: false } }); await applyOn(rds, "RDS"); await rds.end(); }
}
await neon.end(); await g99.end();
console.log("Done. (No matview refresh needed — clinic_search_view doesn't depend on g99 id columns.)");
