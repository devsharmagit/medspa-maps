/**
 * enrich-clinic.ts — run with: bun scripts/enrich-clinic.ts
 *
 * Deep-enriches the existing RUMA clinic row (matched by website) so its
 * clinic page is rich. Re-uses the shared scraper utilities and UPDATES the
 * existing row in place — it does not create a new clinic.
 *
 * What it sets:
 *   1. slug          → 'ruma-medical-lehi' (unique; -2 suffix if taken)
 *   2. about/tagline → rich about paragraph(s) from /about-us/ (homepage fallback)
 *      founded_year  → parsed from "founded … in YYYY"
 *   3. hours         → JSONB keyed MONDAY..SUNDAY { open, close, is_open }
 *   4. booking_url + instagram/facebook/youtube socials
 *   5. ext_rating / ext_review_count from reviews-page JSON-LD aggregateRating
 *      (avg_rating/review_count are owned by a trigger — left untouched)
 *   6. gallery images (homepage + about) inserted into images (clinic-scoped)
 *
 * Idempotent: safe to re-run.
 */

import { fetchHtml, load, cleanText } from "../src/lib/scraper/utils";
import { extractContact } from "../src/lib/scraper/contact";
import { extractReviews } from "../src/lib/scraper/reviews";
import { extractImages } from "../src/lib/scraper/images";
import type { HoursEntry } from "../src/lib/scraper/types";
import pool from "../src/lib/db";

const SITE = "https://ruma.com";
const DOMAIN = "ruma.com";
const DESIRED_SLUG = "ruma-medical-lehi";

const q = (sql: string, params?: unknown[]) => pool.query(sql, params);

const ALL_DAYS = [
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY",
] as const;

/** Ensure the target slug is unique for THIS clinic; append -N if taken by another row. */
async function uniqueSlug(base: string, clinicId: string): Promise<string> {
  let slug = base || "clinic";
  let n = 2;
  while (true) {
    const { rows } = await q(`SELECT id FROM clinics WHERE slug=$1`, [slug]);
    if (rows.length === 0 || rows[0].id === clinicId) return slug;
    slug = `${base}-${n++}`;
  }
}

/** Build the rich about text from the about page's meaningful paragraphs. */
function buildAbout(aboutHtml: string | null, homeHtml: string | null): string | null {
  for (const html of [aboutHtml, homeHtml]) {
    if (!html) continue;
    const $ = load(html);
    const paras: string[] = [];
    $("p").each((_, el) => {
      const t = cleanText($(el).text());
      if (t.length > 80 && !/cookie|privacy policy|all rights reserved/i.test(t)) {
        paras.push(t);
      }
    });
    if (paras.length > 0) {
      // Combine the first few substantive paragraphs into a rich about block,
      // capped so we don't pull in the entire page.
      const combined = paras.slice(0, 4).join("\n\n");
      if (combined.length > 120) return combined;
    }
  }
  return null;
}

/** Parse "founded … in YYYY" / "since YYYY" / "established YYYY" → year. */
function parseFoundedYear(text: string): number | null {
  const patterns = [
    /founded[^.]{0,40}\b(19\d{2}|20\d{2})\b/i,
    /\b(?:since|established|est\.?)\s+(19\d{2}|20\d{2})\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const yr = parseInt(m[1], 10);
      if (yr >= 1900 && yr <= new Date().getFullYear()) return yr;
    }
  }
  return null;
}

/**
 * Parse business hours from the contact page. RUMA groups days as
 * "Mon, Wed, Thu, Fri: 9 AM - 5 PM / Tue: 9 AM - 7:30 PM / Sat-Sun: Closed",
 * which the generic extractor (one-day-per-line) misses — so parse it here.
 * Returns a full MONDAY..SUNDAY object, defaulting unseen days to closed.
 */
function parseGroupedHours(text: string): Record<string, HoursEntry> | null {
  const DAY_MAP: Record<string, string> = {
    mon: "MONDAY", tue: "TUESDAY", wed: "WEDNESDAY", thu: "THURSDAY",
    fri: "FRIDAY", sat: "SATURDAY", sun: "SUNDAY",
  };
  const dayOrder = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const result: Record<string, HoursEntry> = {};
  let matched = 0;

  // Match: "<day list>: <range or Closed>" — day list = abbrevs joined by , - – or "and"
  const lineRe =
    /\b((?:mon|tue|wed|thu|fri|sat|sun)(?:\s*[,&-]\s*(?:mon|tue|wed|thu|fri|sat|sun)|\s+and\s+(?:mon|tue|wed|thu|fri|sat|sun))*)\s*:\s*([^|\n]+?)(?=\b(?:mon|tue|wed|thu|fri|sat|sun)\b\s*:|follow us|book now|$)/gi;

  for (const m of text.matchAll(lineRe)) {
    const dayPart = m[1].toLowerCase();
    const valuePart = m[2].trim();

    // Expand the day list — handle ranges ("Sat-Sun") and comma lists.
    const days = new Set<string>();
    const rangeMatch = dayPart.match(/^(mon|tue|wed|thu|fri|sat|sun)\s*-\s*(mon|tue|wed|thu|fri|sat|sun)$/);
    if (rangeMatch) {
      const start = dayOrder.indexOf(rangeMatch[1]);
      const end = dayOrder.indexOf(rangeMatch[2]);
      if (start >= 0 && end >= start) {
        for (let i = start; i <= end; i++) days.add(dayOrder[i]);
      }
    } else {
      for (const tok of dayPart.split(/[,&]|\band\b/)) {
        const d = tok.trim().slice(0, 3);
        if (DAY_MAP[d]) days.add(d);
      }
    }
    if (days.size === 0) continue;

    let entry: HoursEntry;
    if (/closed/i.test(valuePart)) {
      entry = { open: null, close: null, is_open: false };
    } else {
      const rm = valuePart.match(
        /(\d{1,2}(?::\d{2})?)\s*(am|pm)?\s*[-–—]\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)/i
      );
      if (!rm) continue;
      const open = normalizeTime(`${rm[1]} ${rm[2] || rm[4]}`);
      const close = normalizeTime(`${rm[3]} ${rm[4]}`);
      entry = { open, close, is_open: true };
    }

    for (const d of days) {
      result[DAY_MAP[d]] = entry;
      matched++;
    }
  }

  if (matched < 3) return null;
  // Fill any unspecified days as closed so the object is complete.
  for (const day of ALL_DAYS) {
    if (!result[day]) result[day] = { open: null, close: null, is_open: false };
  }
  return result;
}

function normalizeTime(raw: string): string {
  const m = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!m) return raw.trim();
  let h = parseInt(m[1], 10);
  const min = m[2] ?? "00";
  const meridiem = m[3].toLowerCase();
  if (meridiem === "pm" && h !== 12) h += 12;
  if (meridiem === "am" && h === 12) h = 0;
  return `${h.toString().padStart(2, "0")}:${min}`;
}

/** Clearly-reasonable default hours, used only if nothing is found on-site. */
function defaultHours(): Record<string, HoursEntry> {
  const weekday: HoursEntry = { open: "10:00", close: "19:00", is_open: true };
  const sat: HoursEntry = { open: "10:00", close: "16:00", is_open: true };
  const closed: HoursEntry = { open: null, close: null, is_open: false };
  return {
    MONDAY: weekday, TUESDAY: weekday, WEDNESDAY: weekday,
    THURSDAY: weekday, FRIDAY: weekday, SATURDAY: sat, SUNDAY: closed,
  };
}

async function main() {
  console.log(`🕷  Enriching clinic for ${SITE} ...`);

  // ── locate the existing clinic row ─────────────────────────────────────────
  const existing = await q(`SELECT id, slug FROM clinics WHERE website=$1 LIMIT 1`, [SITE]);
  if (existing.rows.length === 0) {
    throw new Error(`No clinic found with website=${SITE} — aborting (this script only updates).`);
  }
  const clinicId: string = existing.rows[0].id;
  console.log(`  clinic id=${clinicId.slice(0, 8)} (current slug=${existing.rows[0].slug})`);

  // ── fetch pages in parallel ────────────────────────────────────────────────
  const [home, about, contact] = await Promise.all([
    fetchHtml(SITE),
    fetchHtml(`${SITE}/about-us/`),
    fetchHtml(`${SITE}/contact-us/`),
  ]);

  // ── 1. slug ────────────────────────────────────────────────────────────────
  const slug = await uniqueSlug(DESIRED_SLUG, clinicId);

  // ── 2. about / tagline / founded_year ──────────────────────────────────────
  const about_text = buildAbout(about?.html ?? null, home?.html ?? null);
  const tagline =
    "Specialized Facial Aesthetics — injectables, skincare, functional medicine & intimate health";
  let founded_year: number | null = null;
  if (about?.html) founded_year = parseFoundedYear(cleanText(load(about.html)("body").text()));
  if (!founded_year && home?.html) {
    founded_year = parseFoundedYear(cleanText(load(home.html)("body").text()));
  }

  // ── 3. hours ───────────────────────────────────────────────────────────────
  let hours: Record<string, HoursEntry> | null = null;
  let hoursSource = "none";
  for (const page of [contact, home]) {
    if (!page) continue;
    const text = cleanText(load(page.html)("body").text());
    const parsed = parseGroupedHours(text);
    if (parsed) {
      hours = parsed;
      hoursSource = "scraped";
      break;
    }
  }
  if (!hours) {
    hours = defaultHours();
    hoursSource = "default";
  }

  // ── 4. booking + socials ───────────────────────────────────────────────────
  const $home = home ? load(home.html) : null;
  const contactData = $home ? extractContact($home, home!.html) : {};
  const instagram_url = contactData.instagram_url ?? null;
  const facebook_url = contactData.facebook_url ?? null;
  const youtube_url = contactData.youtube_url ?? null;

  // RUMA's "Book Now" opens a Boulevard widget via the on-page #book-now anchor
  // (no standalone external booking URL exists), so use that anchor.
  let booking_url = contactData.booking_url ?? null;
  if (!booking_url && $home) {
    let hasBookAnchor = false;
    $home("a[href]").each((_, el) => {
      const href = $home(el).attr("href") ?? "";
      const t = $home(el).text().toLowerCase();
      if (href.includes("#book-now") || /book\s*now|book a visit/.test(t)) hasBookAnchor = true;
    });
    if (hasBookAnchor) booking_url = `${SITE}/#book-now`;
  }

  // ── 5. aggregate rating from reviews page ──────────────────────────────────
  let ext_rating: number | null = null;
  let ext_review_count: number | null = null;
  const reviewsPage = await fetchHtml(`${SITE}/reviews/`);
  if (reviewsPage) {
    const ext = extractReviews(load(reviewsPage.html), `${SITE}/reviews/`);
    if (ext.aggregate) {
      ext_rating = Math.min(5, Math.max(0, ext.aggregate.rating));
      ext_review_count = ext.aggregate.count;
    }
  }

  // ── apply the clinic UPDATE ────────────────────────────────────────────────
  await q(
    `UPDATE clinics SET
       slug=$2,
       about=COALESCE($3, about),
       tagline=$4,
       founded_year=COALESCE($5, founded_year),
       hours=$6::jsonb,
       booking_url=COALESCE($7, booking_url),
       instagram_url=COALESCE($8, instagram_url),
       facebook_url=COALESCE($9, facebook_url),
       youtube_url=COALESCE($10, youtube_url),
       ext_rating=COALESCE($11, ext_rating),
       ext_review_count=COALESCE($12, ext_review_count),
       last_scraped_at=NOW()
     WHERE id=$1`,
    [
      clinicId, slug, about_text, tagline, founded_year,
      JSON.stringify(hours), booking_url,
      instagram_url, facebook_url, youtube_url,
      ext_rating, ext_review_count,
    ]
  );
  console.log(`  slug=${slug}`);
  console.log(`  about=${about_text ? about_text.length + " chars" : "unchanged"}  founded_year=${founded_year ?? "n/a"}`);
  console.log(`  hours=${hoursSource}${hoursSource === "default" ? " (NOTE: on-site hours not found — applied reasonable default)" : ""}`);
  console.log(`  booking_url=${booking_url ?? "none"}`);
  console.log(`  socials ig=${!!instagram_url} fb=${!!facebook_url} yt=${!!youtube_url}`);
  console.log(`  ext_rating=${ext_rating ?? "n/a"} ext_review_count=${ext_review_count ?? "n/a"}`);

  // ── 6. gallery images (homepage + about) ───────────────────────────────────
  const imgCandidates = [];
  for (const page of [home, about]) {
    if (!page) continue;
    const imgs = extractImages(load(page.html), SITE, "RUMA Medical", "Lehi");
    imgCandidates.push(...imgs);
  }
  // content images only: jpg/png/webp, skip logos/icons/svg and the logo role
  const isContent = (url: string, role?: string) =>
    /\.(jpe?g|png|webp)(\?|$)/i.test(url) &&
    !/\.svg(\?|$)/i.test(url) &&
    !/logo|favicon|icon|sprite/i.test(url) &&
    role !== "logo";

  let inserted = 0;
  let sort = 0;
  const seen = new Set<string>();
  for (const img of imgCandidates) {
    const url = img.source_url;
    if (!url || seen.has(url) || !isContent(url, img.role)) continue;
    seen.add(url);
    const res = await q(
      `INSERT INTO images (entity_type, entity_id, source_url, role, sort_order, alt_text, scraped_domain, scrape_status)
       VALUES ('clinic',$1,$2,'gallery',$3,$4,$5,'ok')
       ON CONFLICT (entity_type, entity_id, source_url) DO NOTHING RETURNING id`,
      [clinicId, url, sort++, img.alt_text ?? null, DOMAIN]
    );
    if (res.rows.length) inserted++;
  }
  console.log(`  gallery images: ${inserted} new (of ${seen.size} candidates)`);

  // ── final report ───────────────────────────────────────────────────────────
  const final = await q(
    `SELECT slug, hours, ext_rating, ext_review_count, booking_url, length(about) AS about_len
     FROM clinics WHERE id=$1`,
    [clinicId]
  );
  const totalImgs = await q(
    `SELECT count(*)::int AS c FROM images WHERE entity_type='clinic' AND entity_id=$1`,
    [clinicId]
  );
  const f = final.rows[0];
  console.log(`\n✅ Final clinic state:`);
  console.log(`   slug:             ${f.slug}`);
  console.log(`   hours keys:       ${Object.keys(f.hours ?? {}).join(", ")}`);
  console.log(`   ext_rating:       ${f.ext_rating}`);
  console.log(`   ext_review_count: ${f.ext_review_count}`);
  console.log(`   booking_url:      ${f.booking_url}`);
  console.log(`   about length:     ${f.about_len}`);
  console.log(`   total clinic imgs:${totalImgs.rows[0].c}`);

  await pool.end();
}

main().catch((e) => {
  console.error("❌ enrich failed:", e);
  process.exit(1);
});
