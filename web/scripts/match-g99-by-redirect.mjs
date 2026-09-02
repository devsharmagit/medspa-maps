// Backfill g99 ids for clinics whose website domain differs from G99's stored domain
// because of a rebrand/redirect. Strategy: shortlist G99 candidates by NAME similarity,
// then VERIFY by following the candidate's website redirect — only link if it lands on our host.
// Usage:
//   node scripts/match-g99-by-redirect.mjs           # dry run
//   node scripts/match-g99-by-redirect.mjs --apply    # write Neon
//   node scripts/match-g99-by-redirect.mjs --apply --rds   # also RDS (RDS_URL env)
// Needs SSH tunnel: G99 prod on :5435 (and :15432 for --rds).
import { Pool } from "pg";
import { execSync } from "node:child_process";
import fs from "node:fs";

const APPLY = process.argv.includes("--apply");
const RDS = process.argv.includes("--rds");
const stripSsl = s => s.replace(/[?&]sslmode=[^&]*/gi, "").replace(/[?&]channel_binding=[^&]*/gi, "");
const readEnv = k => stripSsl(execSync(`grep -m1 '^${k}=' ${import.meta.dirname}/../.env | sed 's/^${k}=//' | tr -d '"'`).toString().trim());
const NEON = readEnv("DATABASE_URL");
const G99 = readEnv("G99_PROD_DATABASE_URL");
const RDS_URL = process.env.RDS_URL ? stripSsl(process.env.RDS_URL) : null;

const host = url => {
  if (!url) return null;
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase() || null; }
};
const STOP = new Set(["med","spa","medspa","medical","aesthetic","aesthetics","wellness","clinic","clinics","center","centre","skin","studio","beauty","health","the","and","co","llc","inc","of","for","by","care","cosmetic","cosmetics","laser","body","face","institute","group","lifestyle","medicine","vein"]);
const norm = s => (s||"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").trim();
const tokens = s => norm(s).split(" ").filter(t => t.length>=3 && !STOP.has(t));
const trigrams = s => { const t="  "+norm(s).replace(/\s+/g," ")+"  "; const g=new Set(); for(let i=0;i<t.length-2;i++) g.add(t.slice(i,i+3)); return g; };
const jac = (a,b)=>{ if(!a.size&&!b.size) return 0; let i=0; for(const x of a) if(b.has(x)) i++; return i/(a.size+b.size-i); };
const nameScore = (n1,n2)=>{
  const t1=new Set(tokens(n1)), t2=new Set(tokens(n2));
  const tok = jac(t1,t2);
  const tri = jac(trigrams(n1),trigrams(n2));
  // strong boost if they share a distinctive (>=4 char) token
  const shareStrong = [...t1].some(t=>t.length>=4 && t2.has(t));
  return Math.max(tok, tri) + (shareStrong?0.5:0);
};

const finalHostCache = new Map();
async function finalHost(h){
  if (finalHostCache.has(h)) return finalHostCache.get(h);
  let out=null;
  try {
    const eff = execSync(`curl -sIL --max-time 15 -o /dev/null -w '%{url_effective}' https://${h}/ 2>/dev/null`).toString().trim();
    out = host(eff);
  } catch { out=null; }
  finalHostCache.set(h,out); return out;
}

const neon = new Pool({ connectionString: NEON, ssl:{rejectUnauthorized:false} });
const g99 = new Pool({ connectionString: G99, ssl:{rejectUnauthorized:false} });

const ours = (await neon.query(
  `SELECT id, name, website FROM clinics WHERE g99_clinic_id IS NULL AND website IS NOT NULL AND website<>''`
)).rows.map(r=>({...r, h:host(r.website)})).filter(r=>r.h);

const pool = (await g99.query(
  `SELECT c.id AS clinic_id, c.tenant_id AS business_id, c.website, b.name AS business_name, c.name AS clinic_name
     FROM clinics c JOIN businesses b ON b.id=c.tenant_id
    WHERE c.deleted IS NOT TRUE AND b.delete_business IS NOT TRUE AND b.deleted IS NOT TRUE
      AND c.website IS NOT NULL AND c.website<>''
      AND c.website NOT ILIKE '%growth99%'`
)).rows.map(r=>({...r, h:host(r.website)})).filter(r=>r.h);

const byHost = new Map();
for (const p of pool) if (!byHost.has(p.h)) byHost.set(p.h, p);

const results = [];
for (const o of ours){
  // 1) exact host
  let hit = byHost.get(o.h);
  let how = hit ? "exact-host" : null;
  // 2) name-shortlist -> redirect verify
  if (!hit){
    const scored = pool.map(p=>({p, s:nameScore(o.name, p.business_name)+0.0001*nameScore(o.name,p.clinic_name)}))
      .filter(x=>x.s>=0.5).sort((a,b)=>b.s-a.s).slice(0,10);
    const seen=new Set();
    for (const {p} of scored){
      if (seen.has(p.h)) continue; seen.add(p.h);
      const fh = await finalHost(p.h);
      if (fh && fh===o.h){ hit=p; how=`redirect:${p.h}->${o.h}`; break; }
    }
  }
  results.push({ o, hit, how });
}

const links = results.filter(r=>r.hit);
const none = results.filter(r=>!r.hit);
console.log(`unmatched clinics: ${ours.length} | linked: ${links.length} | still none: ${none.length}\n`);
for (const r of links) console.log(`  LINK  ${r.o.name} [${r.o.h}] -> clinic=${r.hit.clinic_id} biz=${r.hit.business_id}  (${r.how}; g99name="${r.hit.business_name}")`);
for (const r of none) console.log(`  NONE  ${r.o.name} [${r.o.h}]`);

const ts=new Date().toISOString().slice(0,10);
const dir=`${import.meta.dirname}/../reports`; fs.mkdirSync(dir,{recursive:true});
const esc=v=>{const s=v==null?"":String(v);return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
fs.writeFileSync(`${dir}/match-g99-redirect-${ts}.csv`,
  ["our_clinic_id,name,domain,method,g99_clinic_id,g99_business_id,g99_business_name",
   ...results.map(r=>[r.o.id,r.o.name,r.o.h,r.how||"none",r.hit?.clinic_id,r.hit?.business_id,r.hit?.business_name].map(esc).join(","))].join("\n")+"\n");
console.log(`\nCSV -> reports/match-g99-redirect-${ts}.csv`);

if(!APPLY){ console.log("\nDRY RUN — no writes. Re-run with --apply."); await neon.end(); await g99.end(); process.exit(0);}
if(!links.length){ console.log("Nothing to link."); await neon.end(); await g99.end(); process.exit(0);}

async function applyOn(pl,label){
  const cl=await pl.connect(); let n=0;
  try{ await cl.query("BEGIN");
    for(const r of links){ const res=await cl.query(
      `UPDATE clinics SET g99_clinic_id=COALESCE($2::bigint,g99_clinic_id), g99_business_id=COALESCE($3::bigint,g99_business_id), g99_tenant_id=COALESCE($3::bigint,g99_tenant_id), last_synced_at=NOW() WHERE id=$1 AND g99_clinic_id IS NULL`,
      [r.o.id, r.hit.clinic_id, r.hit.business_id]); n+=res.rowCount; }
    await cl.query("COMMIT"); console.log(`[${label}] rows updated: ${n}`);
  }catch(e){ await cl.query("ROLLBACK"); throw e; } finally{ cl.release(); }
}
await applyOn(neon,"NEON");
if(RDS){ if(!RDS_URL) console.log("[RDS] RDS_URL not set — skipped."); else { const rds=new Pool({connectionString:RDS_URL,ssl:{rejectUnauthorized:false}}); await applyOn(rds,"RDS"); await rds.end(); } }
await neon.end(); await g99.end();
console.log("Done.");
