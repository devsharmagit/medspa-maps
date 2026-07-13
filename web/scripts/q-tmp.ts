/* Post-rerun audit for ruma-medical:
   1. concern list + counts (before: 12 capped / 61 uncapped-with-junk)
   2. every evidence source_url must be homepage/treatment/condition page (no blogs)
   3. every quote re-verified against the LIVE page
   4. junk names (generic symptoms) must be gone
   5. orphaned AI catalog rows (0 members) — list for cleanup */
import pool from "../src/lib/db";
import { fetchHtml, load } from "../src/lib/scraper/utils";

const norm = (s: string) =>
  s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/&amp;/g, "&")
   .replace(/[^\w\s&'"-]/g, " ").replace(/\s+/g, " ").trim();
function htmlToText(html: string): string {
  const $ = load(html); $("script,style,noscript,svg,iframe,head").remove();
  return ($("body").html() ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&[a-z0-9#]+;/gi, " ").replace(/\s+/g, " ").trim();
}

const c = await pool.query(`SELECT id FROM clinics WHERE slug='ruma-medical'`);
const cid = c.rows[0].id;

const cc = await pool.query(`
  SELECT con.name, con.origin FROM clinic_concerns cc JOIN concerns con ON con.id = cc.concern_id
   WHERE cc.clinic_id=$1 AND cc.is_active AND cc.source IN ('scraped','manual') ORDER BY con.name`, [cid]);
console.log(`\n1) CONCERNS (${cc.rows.length}): ` + cc.rows.map((x: {name:string;origin:string}) => `${x.name}[${x.origin}]`).join("; "));

const BLOG_HINT = /(brighten-up|how-can-i|-tips-|-guide|morpheus8-face-and-body|morpheus-8v-womens-health)/i;
const ev = await pool.query(`
  SELECT con.name AS concern, e.raw_phrase, e.evidence_quote, e.source_url
    FROM clinic_concern_evidence e JOIN concerns con ON con.id = e.concern_id
   WHERE e.clinic_id = $1 ORDER BY e.source_url`, [cid]);
console.log(`\n2) EVIDENCE rows: ${ev.rows.length}`);
const srcs = [...new Set(ev.rows.map((r: {source_url:string}) => r.source_url))] as string[];
let blogHits = 0;
for (const s of srcs) {
  const isBlog = BLOG_HINT.test(s);
  if (isBlog) blogHits++;
  console.log(`   ${isBlog ? "❌ BLOG" : "✅"} ${s}`);
}
console.log(`   blog-sourced evidence pages: ${blogHits}`);

// 3) verify every quote against live pages
const pageText = new Map<string, string>();
for (const s of srcs) {
  const r = await fetchHtml(s);
  pageText.set(s, r ? norm(htmlToText(r.html)) : "");
}
let ok = 0, fail = 0;
for (const r of ev.rows) {
  const t = pageText.get(r.source_url) ?? "";
  if (t.includes(norm(r.evidence_quote))) ok++;
  else { fail++; console.log(`   ❌ quote not on page [${r.concern}]: ${r.evidence_quote.slice(0, 80)}`); }
}
console.log(`\n3) QUOTES verified live: ${ok}/${ok + fail}`);

// 4) junk scan
const JUNK = /\b(pain|discomfort|illness|injur|stress|sleep|mood|anxiety|depression|brain fog|craving|lethargy|inflammation|oxidative|cholesterol|blood pressure|hearing|tremor|migraine|headache|problem|issue|concern|change|disorder|performance|slimming)\b/i;
const junk = cc.rows.filter((x: {name:string}) => JUNK.test(x.name));
console.log(`\n4) generic-symptom names remaining: ${junk.length}${junk.length ? " → " + junk.map((x: {name:string}) => x.name).join(", ") : " ✅"}`);

// 5) orphaned AI catalog rows
const orphans = await pool.query(`
  SELECT name, slug FROM concerns con WHERE origin='ai' AND is_active
    AND NOT EXISTS (SELECT 1 FROM clinic_concerns cc WHERE cc.concern_id=con.id AND cc.is_active)
    AND NOT EXISTS (SELECT 1 FROM clinic_concern_evidence e WHERE e.concern_id=con.id)
  ORDER BY name`);
console.log(`\n5) orphaned AI concerns (candidates for cleanup): ${orphans.rows.length}`);
console.log("   " + orphans.rows.map((x: {name:string}) => x.name).join("; "));
await pool.end();
