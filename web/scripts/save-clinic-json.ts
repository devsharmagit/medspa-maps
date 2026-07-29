/**
 * scripts/save-clinic-json.ts — save clinics from pre-extracted JSON payloads,
 * WITHOUT any OpenAI calls. The extraction is done upstream (by Claude sub-agents
 * that scrape the sites); this script only writes through the existing tested
 * save layer: canonical treatment matching + junk filters + geocoding + external
 * rating + G99 linking + concern resolution.
 *
 *   bun scripts/save-clinic-json.ts <dir-or-file> [--dry] [--overwrite]
 *
 * A sub-agent can report any URL it saw in the markup, so this script does the
 * two validations the AI pipeline does that a hand-authored payload otherwise
 * skips:
 *   - every image + provider headshot URL is PROBED (dead/HTML-redirect URLs are
 *     dropped and reported, unknown/blip = kept);
 *   - the cover is chosen by ASPECT RATIO (w/h >= 1.2, same as ingest-clinic.ts)
 *     so a portrait or a wordmark never lands in the landscape hero slot;
 *   - before_after is forced disjoint from cover+gallery (the images unique key
 *     has no role column, so a shared URL would silently no-op).
 * State is stored as the 2-letter abbreviation, matching the existing corpus.
 *
 * Existing domains are SKIPPED by default (same dedup-blocks rule as
 * /admin/add-website); pass --overwrite to deliberately refresh one.
 *
 * Payload shape (one JSON object per clinic):
 * {
 *   "website": "https://example.com/",
 *   "name": "Clinic Name", "tagline": "...", "about": "...",
 *   "phone": "...", "email": "...", "booking_url": "...",
 *   "socials": { "instagram":"", "facebook":"", "tiktok":"", "youtube":"", "x":"", "linkedin":"", "yelp":"" },
 *   "hours": { "MONDAY": {"open":"09:00","close":"17:00","is_open":true}, ... } | null,
 *   "locations": [ { "address":"", "city":"", "state":"", "zip":"", "phone":"" } ],
 *   "providers": [ { "name":"", "title":"", "image_url":"", "is_owner":false } ],
 *   "treatments": ["Botox","Dermal Fillers", ...],
 *   "concerns": ["Acne Scars","Wrinkles", ...],
 *   "images": { "logo":"", "cover":"", "gallery":[""], "before_after":[""] }
 * }
 */
import "dotenv/config";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import pool, { query, queryOne } from "../src/lib/db";
import {
  saveClinicBundle, findClinicsByDomain, websiteDomain,
  type ClinicBundle, type SaveService,
} from "../src/lib/admin/clinic-save";
import { geocodeAddress } from "../src/lib/geocoder";
import { lookupG99ByDomain } from "../src/lib/g99/harvest";
import { resolveClinicRating } from "../src/lib/ratings/fetch-rating";
import { slugify } from "../src/lib/scraper/utils";
import { normalizeState } from "../src/lib/address-parser";
import { isLandscapeImage } from "../src/lib/scraper/image-size";
import { normalize, bestCatalogMatch, isServiceNoise, isConcernNoise } from "../src/lib/taxonomy/canonical";

interface Payload {
  website: string; name: string; tagline?: string; about?: string;
  /**
   * Practice type read off the site — medspa | plastic_surgery | cosmetic_derm |
   * dental_aesthetics | day_spa_salon | wellness_plus_aesthetics |
   * other_medical_plus_aesthetics. Nothing else in the schema distinguishes a
   * plastic surgeon or a nail salon from a medspa.
   */
  clinic_type?: string;
  phone?: string; email?: string; booking_url?: string;
  socials?: Record<string, string | null>;
  hours?: Record<string, unknown> | null;
  locations?: Array<{ address?: string; city?: string; state?: string; zip?: string; phone?: string }>;
  providers?: Array<{ name: string; title?: string; image_url?: string; is_owner?: boolean }>;
  /**
   * Either a plain name (the general treatment is taken to be the name itself) or
   * `{raw_name, general_name}` to point a site-specific variant at an EXISTING
   * catalog treatment. The second form matters: `saveClinicServices` resolves a
   * `public` decision by exact-name match on `general_name` and otherwise CREATES
   * a row, so without it every "VI Peel Purify with Precision Plus" mints its own
   * catalog entry and the catalog fragments one clinic at a time.
   */
  treatments?: Array<string | { raw_name: string; general_name?: string | null }>;
  concerns?: string[];
  images?: { logo?: string; cover?: string; gallery?: string[]; before_after?: string[] };
}

const NON_PHOTO =
  /(?:^|[/_-])(logos?|wordmark|brand|favicons?|icons?|badges?|social[-_]?shar\w*|og[-_]?images?|sharing|carecredit|patientfi|cherry|financing|banners?|categor|menu|text|placeholder|herospace|maps?|staticmaps?|mapbox|mock-?ups?|e-?books?)(?:[/_.-]|$)/i;
const isNonPhoto = (u: string | undefined) => !!u && NON_PHOTO.test((u.split("/").pop() || u));

/**
 * A sub-agent can only report a URL it read off the page — it cannot know the URL
 * actually serves an image. Hotlink protection, CDN 403s and stale WordPress
 * paths all yield a row that renders as a broken tile, so every image URL is
 * probed before it reaches the DB. Real 4xx/5xx are dropped; a network blip or an
 * odd server that rejects Range requests reads as `unknown` and is KEPT (the same
 * degrade-to-accept rule image-size.ts uses, so a flaky host can't strip a
 * clinic's whole gallery).
 */
async function imageLoads(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
      headers: {
        Range: "bytes=0-2047",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "image/*,*/*;q=0.8",
      },
    });
    if (res.status >= 400) return false;
    const ct = res.headers.get("content-type") ?? "";
    // An HTML body means we followed a redirect to a 200 error/consent page.
    if (/^text\/html/i.test(ct)) return false;
    await res.body?.cancel().catch(() => {});
    return true;
  } catch {
    return true; // unknown — keep it rather than wiping a real image
  }
}

/** Filter a URL list down to the ones that genuinely serve an image. */
async function keepLoadable(urls: string[]): Promise<{ kept: string[]; dropped: string[] }> {
  const checked = await Promise.all(urls.map(async (u) => ({ u, ok: await imageLoads(u) })));
  return {
    kept: checked.filter((c) => c.ok).map((c) => c.u),
    dropped: checked.filter((c) => !c.ok).map((c) => c.u),
  };
}

/**
 * Pick the cover the same way ingest-clinic.ts does: the hero slot is ~1.9:1, so
 * demand a genuinely wide image (w/h >= 1.2). Squares and portraits fall through
 * to the gallery instead of being stretched across the hero. Unknown dimensions
 * are accepted. Returns null when nothing qualifies — a clean placeholder beats
 * a portrait or a wordmark pretending to be a hero.
 */
async function pickCover(candidates: string[]): Promise<string | null> {
  for (const u of candidates) {
    if ((await isLandscapeImage(u, { minRatio: 1.2 })) !== false) return u;
  }
  return null;
}

const DAY_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const DAY_LOOKUP: Record<string, string> = {
  mon: "MONDAY", monday: "MONDAY", tue: "TUESDAY", tues: "TUESDAY", tuesday: "TUESDAY",
  wed: "WEDNESDAY", weds: "WEDNESDAY", wednesday: "WEDNESDAY", thu: "THURSDAY", thur: "THURSDAY",
  thurs: "THURSDAY", thursday: "THURSDAY", fri: "FRIDAY", friday: "FRIDAY", sat: "SATURDAY",
  saturday: "SATURDAY", sun: "SUNDAY", sunday: "SUNDAY",
};
const to24h = (raw: string): string | null => {
  const m = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2] ?? "00";
  const mer = m[3]?.toLowerCase();
  if (mer === "pm" && h !== 12) h += 12;
  if (mer === "am" && h === 12) h = 0;
  if (h > 23) return null;
  return `${String(h).padStart(2, "0")}:${min}`;
};

/**
 * Coerce hours into the canonical `{ "MONDAY": {open,close,is_open}, … }` map.
 *
 * Accepts either that map (validated + upper-cased) or a free-text string such as
 * "Monday-Friday: 10 am - 6 pm, Saturday: 10 am - 3 pm, Closed Sunday". The string
 * form matters: 129 clinics in the DB currently store hours as a bare JSON STRING,
 * which the WeeklyHours component cannot render at all — the old version of this
 * script passed `p.hours` straight through. Day RANGES are expanded, which the
 * scraper's own private text parser does not do (it would resolve
 * "Monday-Friday" to Monday alone).
 */
function normalizeHours(input: unknown): Record<string, unknown> | null {
  if (!input) return null;

  if (typeof input === "object" && !Array.isArray(input)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      const day = DAY_LOOKUP[k.toLowerCase().trim()] ?? (DAY_ORDER.includes(k.toUpperCase()) ? k.toUpperCase() : null);
      if (!day || out[day] || typeof v !== "object" || v === null) continue;
      const e = v as { open?: unknown; close?: unknown; is_open?: unknown };
      const open = typeof e.open === "string" ? to24h(e.open) : null;
      const close = typeof e.close === "string" ? to24h(e.close) : null;
      const isOpen = e.is_open === false ? false : !!(open && close);
      out[day] = { open: isOpen ? open : null, close: isOpen ? close : null, is_open: isOpen };
    }
    return Object.keys(out).length ? out : null;
  }

  if (typeof input !== "string") return null;
  const out: Record<string, unknown> = {};
  // Split into day-led segments: "Closed Sunday" and "Sunday: Closed" both work.
  const segments = input.split(/[,;|\n•·]+/).map((s) => s.trim()).filter(Boolean);
  const dayWord = /\b(mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)(?:day|nesday|rsday|urday|sday)?\b/gi;
  for (const seg of segments) {
    const days = [...seg.matchAll(dayWord)].map((m) => DAY_LOOKUP[m[0].toLowerCase()]).filter(Boolean);
    if (days.length === 0) continue;
    // "Monday-Friday" / "Mon – Fri" → the inclusive span between the two days.
    const isRange = days.length >= 2 && /\b\w+\s*[-–—]\s*\w+/.test(seg);
    let targets: string[];
    if (isRange) {
      const a = DAY_ORDER.indexOf(days[0]);
      const b = DAY_ORDER.indexOf(days[1]);
      targets = a <= b ? DAY_ORDER.slice(a, b + 1) : [...DAY_ORDER.slice(a), ...DAY_ORDER.slice(0, b + 1)];
    } else {
      targets = days;
    }
    const range = seg.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:[-–—]|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    const closed = /\b(closed|by appt|by appointment|appointment only)\b/i.test(seg);
    for (const day of targets) {
      if (out[day]) continue;
      if (range && !closed) {
        // A missing meridiem on the opening time takes the closing time's.
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

/**
 * dryReport(p) — resolve this payload's treatments/concerns against the LIVE
 * catalog and report what each one would do, without writing anything.
 *
 * This mirrors `saveClinicServices`' public-decision path exactly: a
 * `public_decision:'public'` service is matched by NORMALIZED EXACT NAME on
 * `general_name` and otherwise CREATES a new catalog row — there is no fuzzy step
 * there. So "would this fragment the catalog?" is answerable before the write,
 * which is the whole point: uncurated payloads have produced 32 and even 117 new
 * rows from a single clinic, against a catalog that already has ~700 single-use
 * rows.
 *
 * Concerns follow save-clinic-json's own resolver: exact, then Dice >= 0.84,
 * then create.
 */
async function dryReport(p: Payload): Promise<void> {
  const domain = websiteDomain(p.website);
  const existing = await findClinicsByDomain(domain);
  const svcCat = (await query<{ name: string; slug: string }>(
    `SELECT name, slug FROM services WHERE is_active = true`
  )).map((r) => ({ ...r, aliases: [] as string[] }));
  const conCat = (await query<{ name: string; slug: string }>(
    `SELECT name, slug FROM concerns WHERE is_active = true`
  )).map((r) => ({ ...r, aliases: [] as string[] }));

  console.log(`\n── ${p.name}  (${domain})${existing.length ? "  [ALREADY IN DB — would skip]" : ""}`);
  console.log(`   type=${p.clinic_type ?? "—"}  locations=${p.locations?.length ?? 0}  providers=${p.providers?.length ?? 0}`);

  const wouldCreateSvc: string[] = [];
  const noiseDropped: string[] = [];
  // Track names created earlier in THIS payload: saveClinicServices inserts the row
  // on first use and every later reference exact-matches it, so three raws sharing
  // one general_name create ONE row, not three. Without this the count inflates and
  // the >3 / >5 budget check fires on payloads that are actually fine.
  const createdHere = new Set<string>();
  for (const t of p.treatments ?? []) {
    const raw = (typeof t === "string" ? t : t.raw_name ?? "").trim();
    const gen = (typeof t === "string" ? t : t.general_name ?? t.raw_name ?? "").trim();
    if (!raw) continue;
    if (isServiceNoise(raw)) { noiseDropped.push(raw); continue; }
    const clean = gen.replace(/[®™©]/g, "").replace(/\s+/g, " ").trim();
    const key = normalize(clean);
    if (svcCat.some((s) => normalize(s.name) === key) || createdHere.has(key)) continue;
    createdHere.add(key);
    wouldCreateSvc.push(clean || raw);
  }

  const wouldCreateCon: string[] = [];
  const conNoise: string[] = [];
  for (const c of p.concerns ?? []) {
    const name = (c ?? "").trim();
    if (!name) continue;
    if (isConcernNoise(name)) { conNoise.push(name); continue; }
    const n = normalize(name);
    if (conCat.some((r) => normalize(r.name) === n || normalize(r.slug) === n)) continue;
    if (bestCatalogMatch(name, conCat, 0.84)) continue;
    wouldCreateCon.push(name);
  }

  const nTx = (p.treatments ?? []).length;
  console.log(`   treatments ${nTx}: ${nTx - wouldCreateSvc.length - noiseDropped.length} EXACT, ${wouldCreateSvc.length} WOULD-CREATE, ${noiseDropped.length} NOISE-DROP`);
  if (wouldCreateSvc.length) console.log(`     WOULD-CREATE: ${wouldCreateSvc.join(" | ")}`);
  if (noiseDropped.length) console.log(`     NOISE-DROP:   ${noiseDropped.join(" | ")}`);
  const nCon = (p.concerns ?? []).length;
  console.log(`   concerns ${nCon}: ${nCon - wouldCreateCon.length - conNoise.length} matched, ${wouldCreateCon.length} WOULD-CREATE, ${conNoise.length} NOISE-DROP`);
  if (wouldCreateCon.length) console.log(`     WOULD-CREATE: ${wouldCreateCon.join(" | ")}`);
  if (conNoise.length) console.log(`     NOISE-DROP:   ${conNoise.join(" | ")}`);
  const verdict = wouldCreateSvc.length > 5 ? "✗ OVER BUDGET (>5)" : wouldCreateSvc.length > 3 ? "⚠ amber (>3)" : "✓ within budget";
  console.log(`   → would create ${wouldCreateSvc.length} services, ${wouldCreateCon.length} concerns   ${verdict}`);
}

async function saveOne(p: Payload, allowOverwrite = false): Promise<Record<string, unknown>> {
  const domain = websiteDomain(p.website);
  if (!domain) return { status: "failed", note: "no domain" };
  const existing = await findClinicsByDomain(domain);
  // Default is dedup-blocks-never-overwrites, matching /admin/add-website. Pass
  // --overwrite to deliberately refresh a clinic that already holds this domain.
  if (existing.length && !allowOverwrite) {
    return { domain, status: "skipped", note: `already in DB (${existing.length} clinic(s))` };
  }

  const g99 = await lookupG99ByDomain(domain).catch(() => null);

  // external rating (free website schema first, Google fallback)
  const loc0 = p.locations?.[0];
  const ratingQuery = [p.name, loc0?.city, loc0?.state].filter(Boolean).join(", ");
  const rating = await resolveClinicRating({ website: p.website, query: ratingQuery || null }).catch(() => null);

  // geocode each location (Nominatim ~1/s)
  const locations = [];
  for (const l of p.locations ?? []) {
    let lat: number | null = null, lng: number | null = null;
    // Full address first; fall back to street-without-suite, then city/state/zip,
    // then zip alone — Nominatim often 0-results on "Suite X" addresses.
    const street = (l.address ?? "").replace(/,?\s*(ste|suite|unit|#|bldg|building|apt|fl(oor)?)\.?\s*\S+.*$/i, "").trim();
    const attempts = [
      [l.address, l.city, l.state, l.zip].filter(Boolean).join(", "),
      [street, l.city, l.state, l.zip].filter(Boolean).join(", "),
      [l.city, l.state, l.zip].filter(Boolean).join(", "),
      [l.city, l.state].filter(Boolean).join(", "),
      l.zip ? `${l.zip}, USA` : "",
    ].filter((a, i, arr) => a && arr.indexOf(a) === i);
    for (const a of attempts) {
      const g = await geocodeAddress(a).catch(() => null);
      if (g) { lat = g.lat; lng = g.lng; break; }
    }
    // Store the 2-letter abbreviation — that is what 846 of the 850 existing
    // clinic_locations rows use. /api/search matches `state = 'TX' OR state
    // ILIKE 'Texas'`, so either form is findable, but a new clinic should not
    // add a third convention.
    locations.push({
      address: l.address ?? null, city: l.city ?? null,
      state: normalizeState(l.state) ?? l.state ?? null,
      zip: l.zip ?? null, phone: l.phone ?? null, lat, lng,
    });
  }
  if (locations.length === 0) locations.push({});

  // treatments → SaveService[] (saveClinicServices applies isServiceNoise + canonical match)
  const services: SaveService[] = (p.treatments ?? [])
    .map((t) => (typeof t === "string" ? { raw_name: t, general_name: t } : t))
    .map((t) => ({
      raw_name: (t.raw_name ?? "").trim(),
      general_name: (t.general_name ?? t.raw_name ?? "").trim(),
    }))
    .filter((t) => t.raw_name && !isServiceNoise(t.raw_name))
    .map((t) => ({
      raw_name: t.raw_name,
      general_name: t.general_name || t.raw_name,
      public_decision: "public" as const,
    }));

  // images — every URL is probed for reachability first, then the cover is chosen
  // by aspect ratio (never a logo/badge/social-share card), then gallery and
  // before/after. before_after MUST be disjoint from cover+gallery: the images
  // unique key is (entity_type, entity_id, source_url) with no role column, so a
  // URL already inserted as gallery makes the before_after insert a silent no-op.
  const rawCover = p.images?.cover && !isNonPhoto(p.images.cover) ? [p.images.cover] : [];
  const rawGallery = (p.images?.gallery ?? []).filter((u) => u && !isNonPhoto(u));
  const rawBA = (p.images?.before_after ?? []).filter(Boolean);
  const rawLogo = p.images?.logo ? [p.images.logo] : [];

  const [coverChk, galleryChk, baChk, logoChk] = await Promise.all([
    keepLoadable(rawCover),
    keepLoadable(rawGallery),
    keepLoadable(rawBA),
    keepLoadable(rawLogo),
  ]);
  const imgDropped = [
    ...coverChk.dropped, ...galleryChk.dropped, ...baChk.dropped, ...logoChk.dropped,
  ];

  // Cover candidates: the declared cover first, then gallery photos as backup —
  // so a portrait "cover" demotes to the gallery instead of blanking the hero.
  const coverUrl = await pickCover([...coverChk.kept, ...galleryChk.kept]);
  const galleryUrls = galleryChk.kept.filter((u) => u !== coverUrl);
  const usedUrls = new Set([...(coverUrl ? [coverUrl] : []), ...galleryUrls, ...logoChk.kept]);

  const gallery: Array<{ source_url: string }> = [
    ...(coverUrl ? [{ source_url: coverUrl }] : []),
    ...galleryUrls.map((u) => ({ source_url: u })),
  ];
  const images = {
    logo: logoChk.kept[0] ? { source_url: logoChk.kept[0] } : null,
    gallery,
    before_after: baChk.kept.filter((u) => !usedUrls.has(u)).map((u) => ({ source_url: u })),
  };

  const s = p.socials ?? {};
  // Provider headshots get the same reachability probe — a dead one silently
  // becomes the shared stockcake placeholder on the clinic page, which looks like
  // a real photo of the wrong person rather than a missing image.
  const provs = (p.providers ?? []).filter((pr) => pr.name?.trim()).slice(0, 10);
  const headshotOk = await Promise.all(
    provs.map(async (pr) => (pr.image_url ? await imageLoads(pr.image_url) : false))
  );

  const bundle: ClinicBundle = {
    website: p.website,
    clinic_type: p.clinic_type ?? null,
    business: { name: p.name || domain },
    clinic: {
      booking_url: p.booking_url ?? null, about: p.about ?? null, tagline: p.tagline ?? null,
      email: p.email ?? null, phone: p.phone ?? null, hours: normalizeHours(p.hours),
      instagram_url: s.instagram ?? null, facebook_url: s.facebook ?? null, tiktok_url: s.tiktok ?? null,
      youtube_url: s.youtube ?? null, x_url: s.x ?? null, linkedin_url: s.linkedin ?? null, yelp_url: s.yelp ?? null,
    },
    locations,
    providers: provs.map((pr, i) => ({
      name: pr.name.trim(), title: pr.title ?? null,
      image_url: headshotOk[i] ? pr.image_url ?? null : null,
      card_tagline: pr.is_owner ? pr.title ?? null : null,
    })),
    services,
    images,
    reviews: [],
    ext_rating: rating?.rating ?? null,
    ext_review_count: rating?.reviewCount ?? null,
    ...(g99 ? { g99_clinic_id: g99.g99_clinic_id, g99_business_id: g99.g99_business_id, g99_tenant_id: g99.g99_tenant_id } : {}),
  };

  const saved = await saveClinicBundle(bundle, { overwrite: true });
  const clinicId = saved.clinics[0]?.id;

  // concerns — resolve/create then link (isConcernNoise backstop)
  let concernsSaved = 0;
  if (clinicId) {
    const catalog = await query<{ id: string; name: string; slug: string }>(`SELECT id, name, slug FROM concerns WHERE is_active = true`);
    const cat = catalog.map((c) => ({ id: c.id, name: c.name, slug: c.slug, aliases: [] as string[] }));
    const seen = new Set<string>();
    for (const raw of p.concerns ?? []) {
      const name = (raw ?? "").trim();
      if (!name || isConcernNoise(name)) continue;
      const n = normalize(name);
      let row = cat.find((c) => normalize(c.name) === n || normalize(c.slug) === n);
      if (!row) { const fz = bestCatalogMatch(name, cat, 0.84); if (fz) row = cat.find((c) => c.slug === fz.entry.slug); }
      if (!row) {
        const base = slugify(name) || "concern"; let sl = base, i = 2;
        while (await queryOne(`SELECT 1 FROM concerns WHERE slug = $1`, [sl])) sl = `${base}-${i++}`;
        const ins = await queryOne<{ id: string; name: string; slug: string }>(
          `INSERT INTO concerns (name, slug, origin, is_active) VALUES ($1,$2,'ai',true)
           ON CONFLICT (slug) DO UPDATE SET updated_at = now() RETURNING id, name, slug`, [name, sl]);
        row = { ...ins!, aliases: [] }; cat.push(row);
      }
      if (seen.has(row.id)) continue; seen.add(row.id);
      await query(
        `INSERT INTO clinic_concerns (clinic_id, concern_id, source, is_active) VALUES ($1,$2,'scraped',true)
         ON CONFLICT (clinic_id, concern_id) DO UPDATE SET source='scraped', is_active=true, updated_at=now()
         WHERE clinic_concerns.source <> 'removed'`, [clinicId, row.id]);
      concernsSaved++;
    }
  }

  return {
    domain, status: "saved", slug: saved.clinics[0]?.slug, clinicId,
    locations: locations.length, geocoded: locations.filter((l) => l.lat != null).length,
    treatments: services.length, matched: saved.servicesMatched, auto: saved.servicesAuto,
    dropped: saved.servicesDropped,
    concernsSaved, providers: bundle.providers?.length ?? 0, images: saved.images,
    cover: coverUrl ? "yes" : "NONE",
    // Surfaced loudly: a dead image URL means the sub-agent read a path off the
    // page that the server will not actually serve.
    ...(imgDropped.length ? { imagesDropped: imgDropped } : {}),
    ...(headshotOk.some((ok, i) => !ok && provs[i].image_url)
      ? { headshotsDropped: provs.filter((_, i) => !headshotOk[i] && provs[i].image_url).map((pr) => pr.name) }
      : {}),
    rating: rating ? `${rating.rating}★/${rating.reviewCount ?? "?"} (${rating.source})` : null,
    g99: g99 ? `${g99.g99_clinic_id}/${g99.g99_business_id}` : null,
  };
}

async function main() {
  const target = process.argv[2];
  const dry = process.argv.includes("--dry");
  const overwrite = process.argv.includes("--overwrite");
  if (!target) throw new Error("usage: bun scripts/save-clinic-json.ts <dir-or-file> [--dry] [--overwrite]");
  const files = statSync(target).isDirectory()
    ? readdirSync(target).filter((f) => f.endsWith(".json")).map((f) => join(target, f))
    : [target];
  console.log(`${files.length} payload file(s)${dry ? " (DRY)" : ""}\n`);

  const summary: Record<string, number> = { saved: 0, skipped: 0, failed: 0 };
  for (const f of files) {
    let p: Payload;
    try { p = JSON.parse(readFileSync(f, "utf8")); } catch (e) { console.log(`✗ ${f} — bad JSON`); summary.failed++; continue; }
    if (dry) { await dryReport(p); continue; }
    try {
      const r = await saveOne(p, overwrite);
      summary[(r.status as string) ?? "failed"]++;
      console.log(`${r.status === "saved" ? "✓" : r.status === "skipped" ? "–" : "✗"} ${p.name} — ${JSON.stringify(r)}`);
    } catch (e) {
      summary.failed++;
      console.log(`✗ ${p.name} — ERROR: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (!dry) {
    try { await query(`REFRESH MATERIALIZED VIEW CONCURRENTLY clinic_search_view`); }
    catch { await query(`REFRESH MATERIALIZED VIEW clinic_search_view`); }
    console.log(`\n── Summary ──  saved=${summary.saved} skipped=${summary.skipped} failed=${summary.failed}  (view refreshed)`);
  }
  await pool.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
