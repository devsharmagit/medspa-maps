/**
 * scripts/filter-batch.ts — after digesting a batch, drop candidates whose REAL
 * (post-redirect) homepage domain is already in the DB, so the Haiku extraction
 * step doesn't waste agents on duplicates. Reads each _digests/<slug>.txt's first
 * "### HOME (url)" line to get the resolved domain.
 *
 *   bun scripts/filter-batch.ts <batchDir>
 * Prints JSON { newSlugs:[...], dups:[...] } and moves dup compacts to _dups/.
 */
import "dotenv/config";
import { readdirSync, readFileSync, mkdirSync, renameSync, existsSync } from "node:fs";
import { join } from "node:path";
import pool, { query } from "../src/lib/db";
import { websiteDomain } from "../src/lib/admin/clinic-save";

async function main() {
  const dir = process.argv[2];
  const cdir = join(dir, "_compact"), ddir = join(dir, "_digests"), dupdir = join(dir, "_dups");
  const have = new Set((await query<{ website: string }>(`SELECT website FROM clinics WHERE website IS NOT NULL`))
    .map((c) => websiteDomain(c.website)).filter(Boolean));
  const newSlugs: string[] = [], dups: string[] = [];
  const seen = new Set<string>();
  for (const f of readdirSync(cdir).filter((x) => x.endsWith(".txt"))) {
    const slug = f.replace(/\.txt$/, "");
    let realDom = "";
    try {
      const first = readFileSync(join(ddir, f), "utf8").split("\n").find((l) => l.startsWith("### HOME"));
      const m = first && /\((https?:\/\/[^)]+)\)/.exec(first);
      if (m) realDom = websiteDomain(m[1]) || "";
    } catch {}
    const key = realDom || slug;
    if ((realDom && have.has(realDom)) || seen.has(key)) {
      dups.push(slug);
      if (!existsSync(dupdir)) mkdirSync(dupdir);
      try { renameSync(join(cdir, f), join(dupdir, f)); } catch {}
    } else {
      seen.add(key); newSlugs.push(slug);
    }
  }
  console.log(JSON.stringify({ newSlugs, dups }));
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
