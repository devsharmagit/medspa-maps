/**
 * refresh-clinic-ratings.ts — refresh every clinic's Google rating + review count
 * from the Google Places API (v1). Ratings drift over time; this re-pulls the
 * current aggregate into ext_rating / ext_review_count / ext_rating_source /
 * ext_rating_updated_at.
 *
 *   bun --env-file=.env scripts/refresh-clinic-ratings.ts            # DRY RUN (no writes)
 *   bun --env-file=.env scripts/refresh-clinic-ratings.ts --apply    # write changes
 *
 * Flags:
 *   --apply             actually write (default is a dry-run preview)
 *   --limit N           only process the first N clinics (testing)
 *   --stale-days N      only refresh clinics whose rating is older than N days (or never stamped)
 *   --only a,b          only these clinic slugs or website domains (comma-separated)
 *   --concurrency N     parallel Places calls (default 6)
 *   --include-inactive  also refresh is_active = false clinics
 *
 * SAFETY (why this only uses place_id):
 *   Each clinic is looked up by the google_place_id of its PRIMARY location only.
 *   The Places response's displayName is verified against the clinic name; if they
 *   don't match, the row is treated as a suspect place_id and SKIPPED (never
 *   overwritten). We do NOT fall back to a free-text Places search for writes —
 *   text search silently resolves to the wrong nearby business and would corrupt
 *   good data (observed: a clinic's 740 reviews replaced by an unrelated 23).
 *   Clinics with no place_id, or whose name fails verification, are reported so
 *   they can be fixed by hand (or via the place_id backfill).
 *
 * Requires GOOGLE_PLACES_API_KEY (or GOOGLE_PLACE_API_KEY) in the environment.
 */
import { Pool } from "pg";

const APPLY = process.argv.includes("--apply");
const argVal = (f: string): string | undefined => {
  const i = process.argv.indexOf(f);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const LIMIT = argVal("--limit") ? Number(argVal("--limit")) : undefined;
const STALE_DAYS = argVal("--stale-days") ? Number(argVal("--stale-days")) : undefined;
const ONLY = argVal("--only")?.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const CONCURRENCY = argVal("--concurrency") ? Number(argVal("--concurrency")) : 6;
const INCLUDE_INACTIVE = process.argv.includes("--include-inactive");
const KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_PLACE_API_KEY;

// ── name verification ────────────────────────────────────────────────────────
const STOP = new Set(["the", "med", "medical", "spa", "medspa", "aesthetic", "aesthetics",
  "wellness", "clinic", "center", "centre", "beauty", "skin", "and", "of", "llc", "inc", "co",
  "studio", "bar", "by", "laser", "health", "surgery", "plastic"]);
const deaccent = (s: string) => (s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "");
function tokens(s: string): Set<string> {
  return new Set(
    deaccent(s).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((t) => t && !STOP.has(t))
  );
}
const concat = (s: string) => deaccent(s).toLowerCase().replace(/[^a-z0-9]/g, "");
/** char-bigram Dice coefficient */
function dice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bg = (x: string) => { const m = new Map<string, number>(); for (let i = 0; i < x.length - 1; i++) { const g = x.slice(i, i + 2); m.set(g, (m.get(g) ?? 0) + 1); } return m; };
  const ma = bg(a), mb = bg(b); let inter = 0;
  for (const [g, n] of ma) if (mb.has(g)) inter += Math.min(n, mb.get(g)!);
  return (2 * inter) / (a.length - 1 + b.length - 1);
}
/** true if the Google displayName plausibly refers to the same business as `name`. */
function nameMatches(name: string, displayName: string): boolean {
  // 1) distinctive shared word (after dropping generic med-spa words + accents)
  const a = tokens(name), b = tokens(displayName);
  let shared = 0; for (const t of a) if (b.has(t)) shared++;
  if (shared >= 1) return true;
  // 2) spacing/concatenation: "Glo Esthetics" == "gloesthetics", "Kim Bell" == "Kimbell"
  const ca = concat(name), cb = concat(displayName);
  if (ca && cb && (ca.includes(cb) || cb.includes(ca))) return true;
  // also compare distinctive-token concatenations (drops the generic words on both sides)
  const da = [...a].join(""), db = [...b].join("");
  if (da && db && (da.includes(db) || db.includes(da))) return true;
  // 3) high character-level similarity on the full concatenated names
  return dice(ca, cb) >= 0.6;
}

interface Row {
  id: string; name: string; website: string; slug: string;
  ext_rating: string | null; ext_review_count: number | null; updated: string | null;
  place_id: string | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function fetchPlace(placeId: string) {
  // retry on 429 (per-minute quota) / 5xx with exponential backoff
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { "X-Goog-Api-Key": KEY!, "X-Goog-FieldMask": "displayName,rating,userRatingCount,businessStatus" },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 429 || res.status >= 500) { await sleep(2000 * (attempt + 1) + Math.random() * 500); continue; }
    if (!res.ok) return null;
    return (await res.json()) as { displayName?: { text?: string }; rating?: number; userRatingCount?: number; businessStatus?: string };
  }
  return null; // exhausted retries
}

async function main() {
  if (!KEY) throw new Error("GOOGLE_PLACES_API_KEY (or GOOGLE_PLACE_API_KEY) not set");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  // one row per clinic, using the PRIMARY location that has a place_id
  const rows: Row[] = (await pool.query(`
    SELECT c.id, c.name, c.website, c.slug, c.ext_rating, c.ext_review_count,
           c.ext_rating_updated_at::text AS updated, l.google_place_id AS place_id
    FROM clinics c
    LEFT JOIN LATERAL (
      SELECT google_place_id FROM clinic_locations
      WHERE clinic_id = c.id AND google_place_id IS NOT NULL
      ORDER BY is_primary DESC NULLS LAST, sort_order ASC NULLS LAST, id ASC LIMIT 1
    ) l ON TRUE
    WHERE ($1 OR c.is_active)
    ORDER BY c.name
  `, [INCLUDE_INACTIVE])).rows;

  let work = rows;
  if (ONLY) work = work.filter((r) => ONLY.includes(r.slug) || ONLY.some((o) => (r.website || "").toLowerCase().includes(o)));
  if (STALE_DAYS !== undefined) {
    const cutoff = Date.now() - STALE_DAYS * 864e5;
    work = work.filter((r) => !r.updated || new Date(r.updated).getTime() < cutoff);
  }
  if (LIMIT !== undefined) work = work.slice(0, LIMIT);

  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${work.length} clinic(s) (of ${rows.length}); place_id-only + name-verified`);
  const stat = { changed: 0, same: 0, noPid: 0, mismatch: 0, noRating: 0, closed: 0, err: 0 };
  const changes: string[] = [], flags: string[] = [];

  let idx = 0;
  async function worker() {
    while (idx < work.length) {
      const r = work[idx++];
      if (!r.place_id) { stat.noPid++; flags.push(`  NO place_id   ${r.name}`); continue; }
      let d; try { d = await fetchPlace(r.place_id); } catch { stat.err++; flags.push(`  ERROR         ${r.name}`); continue; }
      if (!d) { stat.err++; flags.push(`  fetch-failed  ${r.name}`); continue; }
      const dn = d.displayName?.text ?? "";
      if (!nameMatches(r.name, dn)) { stat.mismatch++; flags.push(`  MISMATCH skip ${r.name.padEnd(34)} google="${dn}"`); continue; }
      if (typeof d.rating !== "number") { stat.noRating++; flags.push(`  no-rating     ${r.name} (google="${dn}")`); continue; }
      if (d.businessStatus && d.businessStatus !== "OPERATIONAL") { stat.closed++; flags.push(`  ${d.businessStatus}  ${r.name}`); /* still update rating below */ }

      const newR = d.rating, newC = typeof d.userRatingCount === "number" ? d.userRatingCount : null;
      const oldR = r.ext_rating != null ? Number(r.ext_rating) : null, oldC = r.ext_review_count ?? null;
      if (oldR !== newR || oldC !== newC) { stat.changed++; changes.push(`  ${r.name.padEnd(38)} ${oldR ?? "—"}★/${oldC ?? "—"}  ->  ${newR}★/${newC ?? "—"}`); }
      else stat.same++;

      if (APPLY) await pool.query(
        `UPDATE clinics SET ext_rating=$1, ext_review_count=$2, ext_rating_source='google_places', ext_rating_updated_at=now(), updated_at=now() WHERE id=$3`,
        [newR, newC, r.id]);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));

  if (changes.length) { console.log(`\nchanged (${changes.length}):`); console.log(changes.join("\n")); }
  if (flags.length) { console.log(`\nneeds attention (${flags.length}):`); console.log(flags.join("\n")); }
  console.log(`\nsummary: changed=${stat.changed} unchanged=${stat.same} no-placeid=${stat.noPid} name-mismatch=${stat.mismatch} no-rating=${stat.noRating} not-operational=${stat.closed} errors=${stat.err}`);
  console.log(APPLY ? "APPLIED" : "DRY RUN — pass --apply to write");
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
