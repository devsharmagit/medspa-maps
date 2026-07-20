/**
 * scripts/filter-full.ts — split a digested pool into new candidates vs
 * alternate-domain duplicates (real post-redirect domain already in DB), and
 * emit a full record of the duplicates (candidate domain -> real domain -> the
 * existing clinic it matches). Also flags empty digests.
 *
 *   bun scripts/filter-full.ts <poolDir>
 * Prints JSON { newSlugs, dups:[{cand,real,clinic}], empty:[slug] }.
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pool, { query } from "../src/lib/db";
import { websiteDomain } from "../src/lib/admin/clinic-save";

async function main() {
  const dir = process.argv[2];
  const cdir = join(dir, "_compact"), ddir = join(dir, "_digests");
  const rows = await query<{ name: string; website: string }>(`SELECT name, website FROM clinics WHERE website IS NOT NULL`);
  const byDom = new Map<string, string>();
  for (const r of rows) { const d = websiteDomain(r.website); if (d) byDom.set(d, r.name); }

  const newSlugs: string[] = [], dups: any[] = [], empty: string[] = [];
  const seenReal = new Map<string, string>();
  for (const f of readdirSync(cdir).filter((x) => x.endsWith(".txt"))) {
    const slug = f.replace(/\.txt$/, "");
    let realDom = "", candDom = slug;
    try {
      const dg = readFileSync(join(ddir, f), "utf8");
      const home = dg.split("\n").find((l) => l.startsWith("### HOME"));
      const m = home && /\((https?:\/\/[^)]+)\)/.exec(home);
      if (m) { realDom = websiteDomain(m[1]) || ""; candDom = new URL(m[1]).hostname.replace(/^www\./, ""); }
      // empty digest detection: compact has essentially no TEXT
      const compact = readFileSync(join(cdir, f), "utf8");
      const textLen = compact.split("\n").filter((l) => l.startsWith("TEXT:")).join("").length;
      if (textLen < 120) { empty.push(slug); continue; }
    } catch {}
    if (realDom && byDom.has(realDom)) { dups.push({ cand: candDom, real: realDom, clinic: byDom.get(realDom) }); continue; }
    if (realDom && seenReal.has(realDom)) { dups.push({ cand: candDom, real: realDom, clinic: `(same as ${seenReal.get(realDom)})` }); continue; }
    if (realDom) seenReal.set(realDom, candDom);
    newSlugs.push(slug);
  }
  console.log(JSON.stringify({ newSlugs, dups, empty }));
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
