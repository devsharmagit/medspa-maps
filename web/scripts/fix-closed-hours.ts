/**
 * fix-closed-hours.ts — for clinics whose hours are all-days-closed / missing,
 * scrape their website (no AI) and set the PRIMARY location's hours.
 *
 *   TARGET_DB_URL=... bun scripts/fix-closed-hours.ts --dry [--limit N]
 *   TARGET_DB_URL=... bun scripts/fix-closed-hours.ts --apply [--limit N] [--concurrency N]
 *
 * Uses the deterministic scraper (fetchHtml + extractHours); only writes a result
 * that has >= 1 open day (never overwrites all-closed with all-closed).
 */
import { Pool } from "pg";
import { load } from "cheerio";
import { fetchHtml } from "../src/lib/scraper/utils";
import { extractHours } from "../src/lib/scraper/contact";

const DB_URL = process.env.TARGET_DB_URL!;
const APPLY = process.argv.includes("--apply");
const argVal = (f: string) => { const i = process.argv.indexOf(f); return i >= 0 ? process.argv[i + 1] : undefined; };
const LIMIT = argVal("--limit") ? Number(argVal("--limit")) : undefined;
const CONCURRENCY = argVal("--concurrency") ? Number(argVal("--concurrency")) : 6;

const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const DAY_LOOKUP: Record<string, string> = {
  mon: "MONDAY", monday: "MONDAY", tue: "TUESDAY", tues: "TUESDAY", tuesday: "TUESDAY",
  wed: "WEDNESDAY", weds: "WEDNESDAY", wednesday: "WEDNESDAY", thu: "THURSDAY", thur: "THURSDAY",
  thurs: "THURSDAY", thursday: "THURSDAY", fri: "FRIDAY", friday: "FRIDAY", sat: "SATURDAY",
  saturday: "SATURDAY", sun: "SUNDAY", sunday: "SUNDAY",
};

const to24h = (raw: string): string | null => {
  const m = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10); const min = m[2] ?? "00"; const mer = m[3]?.toLowerCase();
  if (mer === "pm" && h !== 12) h += 12;
  if (mer === "am" && h === 12) h = 0;
  if (h > 23) return null;
  return `${String(h).padStart(2, "0")}:${min}`;
};

/** Free-text hours parser (footer strings like "Mon–Fri 9–6, Sat 10–3, Closed Sun"). */
function parseHoursText(input: string): Record<string, { open: string | null; close: string | null; is_open: boolean }> | null {
  const out: Record<string, { open: string | null; close: string | null; is_open: boolean }> = {};
  // Break BETWEEN day entries only — after an entry-ending token (a time digit,
  // am/pm, or "closed") that is immediately followed by a new day word. This
  // segments run-together blobs like "…5:00pmTuesday…" WITHOUT splitting a
  // "Tue - Fri" range (whose second day is preceded by a dash, not a time).
  const pre = input.replace(
    /([\d)]|[ap]\.?m\.?|closed|appt|appointment)\s*(?=(?:mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)(?:day|nesday|rsday|urday|sday)?\b)/gi,
    "$1\n"
  );
  const segments = pre.split(/[,;|\n•·]+/).map((s) => s.trim()).filter(Boolean);
  const dayWord = /\b(mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)(?:day|nesday|rsday|urday|sday)?\b/gi;
  for (const seg of segments) {
    if (seg.length > 120) continue; // skip prose blobs
    const days = [...seg.matchAll(dayWord)].map((m) => DAY_LOOKUP[m[0].toLowerCase()]).filter(Boolean);
    if (days.length === 0) continue;
    const isRange = days.length >= 2 && /\b\w+\s*[-–—]\s*\w+/.test(seg);
    const targets = isRange
      ? (() => { const a = DAYS.indexOf(days[0]); const b = DAYS.indexOf(days[1]);
          return a <= b ? DAYS.slice(a, b + 1) : [...DAYS.slice(a), ...DAYS.slice(0, b + 1)]; })()
      : days;
    const range = seg.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:[-–—]|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    const closed = /\b(closed|by appt|by appointment|appointment only)\b/i.test(seg);
    for (const day of targets) {
      if (out[day]) continue;
      if (range && !closed) {
        const mer = range[2].match(/am|pm/i)?.[0] ?? "";
        const open = to24h(/am|pm/i.test(range[1]) ? range[1] : `${range[1]} ${mer}`);
        const close = to24h(range[2]);
        out[day] = open && close ? { open, close, is_open: true } : { open: null, close: null, is_open: false };
      } else if (closed) {
        out[day] = { open: null, close: null, is_open: false };
      }
    }
  }
  return Object.keys(out).length ? out : null;
}

/** Coerce extractHours' output to the canonical {MONDAY:{open,close,is_open}} map. */
function canonicalize(raw: Record<string, { open: string | null; close: string | null; is_open: boolean }> | null) {
  if (!raw) return null;
  const out: Record<string, { open: string | null; close: string | null; is_open: boolean }> = {};
  for (const [k, v] of Object.entries(raw)) {
    const day = DAY_LOOKUP[k.toLowerCase().trim()] ?? (DAYS.includes(k.toUpperCase()) ? k.toUpperCase() : null);
    if (!day || out[day]) continue;
    // Guard against degenerate parses (open >= close inversions / equal times).
    const openOk = v.is_open && v.open && v.close && v.open < v.close;
    out[day] = openOk
      ? { open: v.open, close: v.close, is_open: true }
      : { open: null, close: null, is_open: false };
  }
  const openDays = Object.values(out).filter((d) => d.is_open).length;
  return openDays > 0 ? out : null;
}

async function mapLimit<T>(items: T[], limit: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; await fn(items[idx]); }
  }));
}

async function main() {
  const who = await pool.query(`SELECT current_user, current_database()`);
  console.log(`${JSON.stringify(who.rows[0])}  ${APPLY ? "APPLY" : "DRY"}`);

  // All-days-closed / no-hours clinics + website + primary location id.
  const { rows } = await pool.query<{ slug: string; website: string | null; loc_id: string | null }>(`
    SELECT c.slug, c.website,
      (SELECT l.id FROM clinic_locations l WHERE l.clinic_id=c.id AND l.is_active=true
         ORDER BY l.is_primary DESC, l.sort_order, l.created_at LIMIT 1) AS loc_id
    FROM clinics c
    WHERE c.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM clinic_locations l
        WHERE l.clinic_id=c.id AND l.is_active=true
          AND l.hours IS NOT NULL AND jsonb_typeof(l.hours)='object'
          AND EXISTS (SELECT 1 FROM jsonb_each(l.hours) d WHERE (d.value->>'is_open')::boolean IS TRUE)
      )
    ORDER BY c.name`);

  const targets = (LIMIT ? rows.slice(0, LIMIT) : rows).filter((r) => r.website && r.loc_id);
  console.log(`candidates: ${rows.length}, processing: ${targets.length}`);

  const tally = { found: 0, none: 0, failed: 0 };
  const foundSlugs: string[] = [];

  // Try the homepage first, then common contact/hours pages (some clinics only
  // list hours on /contact). Stop at the first page that yields hours.
  const candidateUrls = (base: string): string[] => {
    let root = base.trim();
    try { root = new URL(base).origin; } catch { /* keep as-is */ }
    return [base, ...["contact", "contact-us", "hours", "location", "locations", "about", "about-us"]
      .map((p) => `${root}/${p}/`)]
      .filter((u, i, a) => a.indexOf(u) === i);
  };

  const scrapeHours = async (url: string) => {
    const page = await fetchHtml(url);
    if (!page) return { ok: false as const, res: null };
    const $ = load(page.html);
    let res = canonicalize(extractHours($, page.html));
    if (!res) {
      $("script,style,noscript").remove();
      // Smallest block that mentions a day AND a time — the hours widget.
      let best = "";
      $("div,section,li,ul,ol,tr,table,p,aside,footer,address").each((_i, el) => {
        const t = $(el).text().replace(/[ \t\r]+/g, " ").trim();
        if (t.length < 8 || t.length > 500) return;
        if (/(mon|tue|wed|thu|fri|sat|sun)/i.test(t) && /\d\s*(a\.?m\.?|p\.?m\.?|:)/i.test(t)) {
          if (!best || t.length < best.length) best = t;
        }
      });
      const text = [best, $("footer").text(), $('[class*="hour" i],[id*="hour" i]').text()]
        .join("\n").replace(/[ \t\r]+/g, " ");
      res = canonicalize(parseHoursText(text));
    }
    return { ok: true as const, res };
  };

  await mapLimit(targets, CONCURRENCY, async (r) => {
    let res = null;
    let anyOk = false;
    for (const url of candidateUrls(r.website!)) {
      try {
        const out = await scrapeHours(url);
        if (out.ok) anyOk = true;
        if (out.res) { res = out.res; break; }
      } catch { /* try next candidate */ }
    }
    if (!anyOk && !res) { tally.failed++; return; }

    if (!res) { tally.none++; return; }
    tally.found++;
    foundSlugs.push(r.slug);
    if (process.argv.includes("--print")) {
      const compact = Object.entries(res).map(([d, v]) => `${d.slice(0, 3)}:${v.is_open ? `${v.open}-${v.close}` : "x"}`).join(" ");
      console.log(`  ${r.slug}\t${compact}`);
    }
    if (APPLY) {
      await pool.query(`UPDATE clinic_locations SET hours=$2::jsonb, updated_at=now() WHERE id=$1`,
        [r.loc_id, JSON.stringify(res)]);
    }
  });

  console.log(`\nRESULT  found=${tally.found}  no-hours-on-site=${tally.none}  fetch-failed=${tally.failed}`);
  console.log(`found sample: ${foundSlugs.slice(0, 30).join(", ")}`);
  if (APPLY) console.log(`APPLIED hours to ${tally.found} clinics' primary locations.`);
  await pool.end();
}
main().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
