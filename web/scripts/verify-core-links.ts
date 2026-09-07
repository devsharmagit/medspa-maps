/**
 * verify-core-links.ts — prove the 2026-09-06 reduction left no dead link.
 *
 * Four checks, all read-only, no dev server needed:
 *
 *  1. The live catalog is exactly the 19 + 14 the code believes in.
 *  2. Every hardcoded /search?q= and /search?condition= link in src/ resolves
 *     to an ACTIVE catalog row. This is what catches a blog CTA or landing-page
 *     button left pointing at a slug the reduction retired.
 *  3. Every retired slug and every retired display NAME still resolves — the
 *     redirect's whole job. A user's bookmark of ?q=morpheus8 must not become a
 *     confident "0 Practices Found".
 *  4. The homepage carousel's hand-typed clinic counts still match the live
 *     ones. They are deliberately static, so this is their expiry alarm: a
 *     snapshot taken mid-backfill once shipped "Lip Fillers 40+" against a real
 *     403, and nothing caught it but a human noticing.
 *
 *   bun --env-file=.env scripts/verify-core-links.ts
 *
 * Exits non-zero on any failure, so it can gate a deploy.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import {
  CORE_TREATMENT_SLUGS, CORE_CONCERN_SLUGS,
  LEGACY_TREATMENT_REDIRECT, LEGACY_CONCERN_REDIRECT,
  coreTreatmentFor, coreConcernFor,
} from "../src/lib/taxonomy/core-catalog";
import { POPULAR_TREATMENTS } from "@/data/popular-treatments";
import { getSearchOptionCounts } from "@/lib/search/option-counts";

const LINK_RE = /\/search\?(q|condition)=([A-Za-z0-9%_-]+)/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".next" || e.startsWith(".")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|md|mdx)$/.test(e)) out.push(p);
  }
  return out;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  const activeT = new Set((await pool.query(`SELECT slug FROM services WHERE is_active`)).rows.map((r) => r.slug));
  const activeC = new Set((await pool.query(`SELECT slug FROM concerns WHERE is_active`)).rows.map((r) => r.slug));
  await pool.end();

  let fail = 0;
  const bad = (msg: string) => { console.log(`  FAIL  ${msg}`); fail++; };

  // ---- 1. catalog matches the code
  console.log("1. live catalog vs core-catalog.ts");
  for (const s of CORE_TREATMENT_SLUGS) if (!activeT.has(s)) bad(`treatment "${s}" is in code but not active in the DB`);
  for (const s of CORE_CONCERN_SLUGS) if (!activeC.has(s)) bad(`concern "${s}" is in code but not active in the DB`);
  for (const s of activeT) if (!CORE_TREATMENT_SLUGS.includes(s)) bad(`treatment "${s}" is active in the DB but not core`);
  for (const s of activeC) if (!CORE_CONCERN_SLUGS.includes(s)) bad(`concern "${s}" is active in the DB but not core`);
  console.log(`   ${activeT.size} treatments, ${activeC.size} concerns`);

  // ---- 2. hardcoded links
  console.log("\n2. hardcoded /search links in src/");
  const links = new Map<string, string[]>();
  for (const file of walk("src")) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(LINK_RE)) {
      const key = `${m[1]}=${decodeURIComponent(m[2])}`;
      if (!links.has(key)) links.set(key, []);
      links.get(key)!.push(file);
    }
  }
  for (const [link, files] of [...links].sort()) {
    const [kind, value] = link.split("=");
    // Search is an EXACT slug lookup as of 2026-09-07 — no aliases, no fuzzy,
    // no retired-slug redirect. So a hardcoded link is only valid if it names
    // an active slug outright. This check used to mirror the old four-pass
    // resolver, which would now pass links that production returns nothing for.
    const ok = kind === "q"
      ? activeT.has(value) || activeC.has(value)
      : activeC.has(value);
    if (ok) console.log(`   ok    ?${link}`);
    else bad(`?${link} is not an active slug — ${files[0]}`);
  }
  if (!links.size) console.log("   (none found)");

  // ---- 3. the retired-slug map still round-trips
  //
  // Search no longer uses this map, but INGEST does: catalog-policy.ts is what
  // places a scraped "Morpheus8" onto RF Microneedling so the closed catalog
  // does not drop that clinic's row. This check is the regression test that
  // protects it — keep it even though nothing user-facing reads the map.
  console.log("\n3. retired slug/name redirects (used by the INGEST gate, not search)");
  let checked = 0;
  for (const [legacy, core] of Object.entries(LEGACY_TREATMENT_REDIRECT)) {
    checked++;
    if (coreTreatmentFor(legacy) !== core) bad(`treatment redirect "${legacy}" broken`);
    else if (!activeT.has(core)) bad(`treatment "${legacy}" redirects to inactive "${core}"`);
  }
  for (const [legacy, core] of Object.entries(LEGACY_CONCERN_REDIRECT)) {
    checked++;
    if (coreConcernFor(legacy) !== core) bad(`concern redirect "${legacy}" broken`);
    else if (!activeC.has(core)) bad(`concern "${legacy}" redirects to inactive "${core}"`);
  }
  console.log(`   ${checked} redirects checked`);

  // ---- 4. the homepage carousel's static counts vs the live ones
  //
  // Same function the search dropdown calls, at national scope, so "the card
  // and the dropdown agree" is true by construction rather than by hand.
  console.log("\n4. homepage POPULAR_TREATMENTS counts vs live");
  const live = new Map(
    (await getSearchOptionCounts(new URLSearchParams())).treatments.map((t) => [t.slug, t.count]),
  );
  const TOLERANCE = 0.1;
  const drift: string[] = [];
  for (const t of POPULAR_TREATMENTS) {
    const actual = live.get(t.slug);
    if (actual === undefined) {
      bad(`carousel lists "${t.slug}", which the live catalog does not offer`);
      continue;
    }
    // Percentage of the LIVE value: a static 40 against a live 403 is 90% off
    // whichever way you divide, but this way the threshold means "how wrong is
    // the number we show" rather than "how much has it grown".
    const off = Math.abs(actual - t.clinicCount) / Math.max(actual, 1);
    if (off > TOLERANCE) {
      drift.push(
        `   ${t.slug.padEnd(24)} shows ${String(t.clinicCount).padStart(4)}  live ${String(actual).padStart(4)}  (${(off * 100).toFixed(0)}% off)`,
      );
    }
  }
  for (const s of CORE_TREATMENT_SLUGS) {
    if (!POPULAR_TREATMENTS.some((t) => t.slug === s)) {
      bad(`treatment "${s}" is core but missing from the homepage carousel`);
    }
  }
  if (drift.length) {
    console.log(drift.join("\n"));
    bad(`${drift.length} carousel count(s) more than ${TOLERANCE * 100}% off — refresh src/data/popular-treatments.ts`);
  } else {
    console.log(`   ${POPULAR_TREATMENTS.length} counts within ${TOLERANCE * 100}%`);
  }

  console.log(fail === 0 ? "\nALL CHECKS PASSED" : `\n${fail} FAILURES`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
