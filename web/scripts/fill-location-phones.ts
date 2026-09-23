/**
 * fill-location-phones.ts — backfill clinic_locations.phone for locations that
 * have none, by scraping the clinic website (NO AI).
 *
 *   TARGET_DB_URL=... bun scripts/fill-location-phones.ts --dry [--limit N] [--concurrency N]
 *   TARGET_DB_URL=... bun scripts/fill-location-phones.ts --apply [--limit N] [--concurrency N]
 *
 * Single-location clinics: extractPhone(home/contact) fills the one location.
 * Multi-location clinics: detectLocations() gives per-city phones matched by city;
 * if the site exposes exactly one distinct phone, that is used as a shared fallback.
 * Only ever WRITES a phone into an empty location; never overwrites an existing one.
 */
import { Pool } from "pg";
import { load } from "cheerio";
import { fetchHtml } from "../src/lib/scraper/utils";
import { extractPhone, extractEmail } from "../src/lib/scraper/contact";
import { detectLocations } from "../src/lib/scraper/locations";

const DB_URL = process.env.TARGET_DB_URL!;
const APPLY = process.argv.includes("--apply");
const argVal = (f: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; };
const LIMIT = argVal("--limit") ? Number(argVal("--limit")) : undefined;
const CONCURRENCY = argVal("--concurrency") ? Number(argVal("--concurrency")) : 6;

const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

const norm = (s: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const empty = (p: string | null) => !p || !p.trim();
const digits = (p: string) => p.replace(/\D/g, "");
const validPhone = (p: string | null | undefined): p is string => !!p && digits(p).length >= 10 && digits(p).length <= 11;

async function mapLimit<T>(items: T[], limit: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; await fn(items[idx]); }
  }));
}

interface Loc { id: string; city: string | null; label: string | null; phone: string | null; }

async function main() {
  const who = await pool.query(`SELECT current_user, current_database()`);
  console.log(`${JSON.stringify(who.rows[0])}  ${APPLY ? "APPLY" : "DRY"}`);

  // Clinics that have >=1 active location with no phone, and a website to scrape.
  const { rows: clinics } = await pool.query<{ id: string; slug: string; website: string }>(`
    SELECT DISTINCT c.id, c.slug, c.website
    FROM clinics c JOIN clinic_locations l ON l.clinic_id=c.id
    WHERE c.is_active=true AND l.is_active=true
      AND (l.phone IS NULL OR btrim(l.phone)='')
      AND c.website IS NOT NULL AND btrim(c.website)<>''
    ORDER BY c.slug`);

  const targets = LIMIT ? clinics.slice(0, LIMIT) : clinics;
  console.log(`clinics needing phones: ${clinics.length}, processing: ${targets.length}`);

  const tally = { clinics: 0, locsFilled: 0, none: 0, failed: 0 };
  const sample: string[] = [];

  const candidateUrls = (base: string): string[] => {
    let root = base.trim();
    try { root = new URL(base).origin; } catch { /* keep */ }
    return [base, ...["contact", "contact-us", "locations", "location", "about"].map((p) => `${root}/${p}/`)]
      .filter((u, i, a) => a.indexOf(u) === i);
  };

  await mapLimit(targets, CONCURRENCY, async (c) => {
    const locs = (await pool.query<Loc>(
      `SELECT id, city, label, phone FROM clinic_locations WHERE clinic_id=$1 AND is_active=true`, [c.id])).rows;
    const needy = locs.filter((l) => empty(l.phone));
    if (!needy.length) return;

    // Fetch homepage (required) + first contact-ish page that loads.
    const home = await fetchHtml(c.website);
    if (!home) { tally.failed++; return; }
    const $home = load(home.html);
    let $contact: ReturnType<typeof load> | undefined;
    let contactHtml = "";
    for (const u of candidateUrls(c.website).slice(1)) {
      try { const p = await fetchHtml(u); if (p) { $contact = load(p.html); contactHtml = p.html; break; } } catch { /* next */ }
    }

    // Site-wide single phone (fallback for shared main lines).
    const homePhone = extractPhone($home, home.html);
    const contactPhone = $contact ? extractPhone($contact, contactHtml) : null;

    // Per-city phones via location detection.
    const cityPhone = new Map<string, string>();
    const distinct = new Set<string>();
    const pushPhone = (p?: string | null) => { if (validPhone(p)) distinct.add(digits(p)); };
    pushPhone(homePhone); pushPhone(contactPhone);
    try {
      const merged = { name: undefined, address: null, city: null, state: null, zip: null,
        lat: null, lng: null, phone: homePhone ?? contactPhone ?? undefined,
        email: (extractEmail($home, home.html) ?? undefined) } as any;
      const detected = await detectLocations($home, home.html, c.website, merged, $contact, contactHtml);
      for (const d of detected) {
        if (validPhone(d.phone)) {
          pushPhone(d.phone);
          const k = norm(d.city ?? d.name ?? null);
          if (k && !cityPhone.has(k)) cityPhone.set(k, d.phone!.trim());
        }
      }
    } catch { /* detection best-effort */ }

    const soleFallback = distinct.size === 1
      ? (homePhone && validPhone(homePhone) ? homePhone.trim()
         : contactPhone && validPhone(contactPhone) ? contactPhone.trim()
         : [...cityPhone.values()][0])
      : null;
    // For single-location clinics, any found phone applies.
    const singleLocFallback = locs.length === 1
      ? (validPhone(homePhone) ? homePhone!.trim() : validPhone(contactPhone) ? contactPhone!.trim() : soleFallback)
      : null;

    let filledThisClinic = 0;
    for (const l of needy) {
      const byCity = cityPhone.get(norm(l.city)) ?? cityPhone.get(norm(l.label));
      const phone = byCity ?? singleLocFallback ?? soleFallback;
      if (!phone) continue;
      filledThisClinic++;
      tally.locsFilled++;
      if (sample.length < 25) sample.push(`${c.slug} [${l.city ?? l.label ?? "?"}] -> ${phone}${byCity ? "" : soleFallback && !singleLocFallback ? " (shared)" : ""}`);
      if (APPLY) await pool.query(`UPDATE clinic_locations SET phone=$2, updated_at=now() WHERE id=$1`, [l.id, phone]);
    }
    if (filledThisClinic) tally.clinics++; else tally.none++;
  });

  console.log(`\nRESULT ${JSON.stringify(tally)}`);
  console.log(sample.join("\n"));
  await pool.end();
}
main().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
