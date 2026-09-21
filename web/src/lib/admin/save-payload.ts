/**
 * admin/save-payload.ts — save ONE clinic from a pre-extracted JSON payload,
 * WITHOUT any OpenAI calls. This is the shared engine behind both the
 * `scripts/save-clinic-json.ts` batch tool and the admin "Add clinic from JSON"
 * page (`/admin/add-json`), so a pasted payload goes through the exact same
 * tested save path: canonical treatment matching + junk filters + geocoding +
 * external rating + G99 id linking + concern resolution.
 *
 * Runs entirely through the app's DB pool, so in production it uses the deployed
 * app's privileged role (the same one /admin/add-website writes with).
 */

import { query, queryOne } from "@/lib/db";
import {
  saveClinicBundle,
  findClinicsByDomain,
  websiteDomain,
  type ClinicBundle,
  type SaveService,
} from "@/lib/admin/clinic-save";
import { geocodeAddress } from "@/lib/geocoder";
import { lookupG99ByDomain } from "@/lib/g99/harvest";
import { resolveClinicRating } from "@/lib/ratings/fetch-rating";
import { slugify } from "@/lib/scraper/utils";
import { normalizeState } from "@/lib/address-parser";
import { isCatalogClosed, coreRowFor } from "@/lib/taxonomy/catalog-policy";
import { isLandscapeImage } from "@/lib/scraper/image-size";
import {
  normalize,
  bestCatalogMatch,
  isServiceNoise,
  isConcernNoise,
} from "@/lib/taxonomy/canonical";

export interface ClinicJsonPayload {
  website: string;
  name: string;
  tagline?: string;
  about?: string;
  clinic_type?: string;
  phone?: string;
  email?: string;
  booking_url?: string;
  socials?: Record<string, string | null>;
  hours?: Record<string, unknown> | null;
  locations?: Array<{ address?: string; city?: string; state?: string; zip?: string; phone?: string }>;
  providers?: Array<{ name: string; title?: string; image_url?: string; is_owner?: boolean }>;
  treatments?: Array<string | { raw_name: string; general_name?: string | null }>;
  concerns?: string[];
  images?: { logo?: string; cover?: string; gallery?: string[]; before_after?: string[] };
}

// ── image helpers ────────────────────────────────────────────────────────────

const NON_PHOTO =
  /(?:^|[/_-])(logos?|wordmark|brand|favicons?|icons?|badges?|social[-_]?shar\w*|og[-_]?images?|sharing|carecredit|patientfi|cherry|financing|banners?|categor|menu|text|placeholder|herospace|maps?|staticmaps?|mapbox|mock-?ups?|e-?books?)(?:[/_.-]|$)/i;
const isNonPhoto = (u: string | undefined) => !!u && NON_PHOTO.test(u.split("/").pop() || u);

/** Probe a URL: real 4xx/5xx or an HTML redirect → drop; network blip → keep. */
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
    if (/^text\/html/i.test(ct)) return false;
    await res.body?.cancel().catch(() => {});
    return true;
  } catch {
    return true;
  }
}

async function keepLoadable(urls: string[]): Promise<{ kept: string[]; dropped: string[] }> {
  const checked = await Promise.all(urls.map(async (u) => ({ u, ok: await imageLoads(u) })));
  return {
    kept: checked.filter((c) => c.ok).map((c) => c.u),
    dropped: checked.filter((c) => !c.ok).map((c) => c.u),
  };
}

/** Cover must be genuinely wide (w/h >= 1.2); unknown dims accepted. */
async function pickCover(candidates: string[]): Promise<string | null> {
  for (const u of candidates) {
    if ((await isLandscapeImage(u, { minRatio: 1.2 })) !== false) return u;
  }
  return null;
}

// ── hours normalization ──────────────────────────────────────────────────────

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
  const segments = input.split(/[,;|\n•·]+/).map((s) => s.trim()).filter(Boolean);
  const dayWord = /\b(mon|tue|tues|wed|weds|thu|thur|thurs|fri|sat|sun)(?:day|nesday|rsday|urday|sday)?\b/gi;
  for (const seg of segments) {
    const days = [...seg.matchAll(dayWord)].map((m) => DAY_LOOKUP[m[0].toLowerCase()]).filter(Boolean);
    if (days.length === 0) continue;
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

// ── main ─────────────────────────────────────────────────────────────────────

export interface SavePayloadResult {
  domain: string | null;
  status: "saved" | "skipped" | "failed";
  note?: string;
  slug?: string;
  clinicId?: string;
  treatments?: number;
  matched?: number;
  concernsSaved?: number;
  providers?: number;
  cover?: string;
  rating?: string | null;
  g99?: string | null;
  imagesDropped?: string[];
}

/**
 * Save one clinic payload. `overwrite:false` (default) skips a domain already in
 * the DB (same dedup rule as /admin/add-website).
 */
export async function saveClinicFromPayload(
  p: ClinicJsonPayload,
  opts: { overwrite?: boolean } = {}
): Promise<SavePayloadResult> {
  const allowOverwrite = opts.overwrite ?? false;
  const domain = websiteDomain(p.website);
  if (!domain) return { domain: null, status: "failed", note: "no domain in website" };
  if (!p.name) return { domain, status: "failed", note: "missing name" };

  const existing = await findClinicsByDomain(domain);
  if (existing.length && !allowOverwrite) {
    return { domain, status: "skipped", note: `already in DB (${existing.length} clinic(s))` };
  }

  const g99 = await lookupG99ByDomain(domain).catch(() => null);

  const loc0 = p.locations?.[0];
  const ratingQuery = [p.name, loc0?.city, loc0?.state].filter(Boolean).join(", ");
  const rating = await resolveClinicRating({ website: p.website, query: ratingQuery || null }).catch(() => null);

  const locations = [];
  for (const l of p.locations ?? []) {
    let lat: number | null = null, lng: number | null = null;
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
    locations.push({
      address: l.address ?? null, city: l.city ?? null,
      state: normalizeState(l.state) ?? l.state ?? null,
      zip: l.zip ?? null, phone: l.phone ?? null, lat, lng,
    });
  }
  if (locations.length === 0) locations.push({});

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
  const imgDropped = [...coverChk.dropped, ...galleryChk.dropped, ...baChk.dropped, ...logoChk.dropped];

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

  // concerns — resolve/create then link (isConcernNoise backstop, closed-catalog rule)
  let concernsSaved = 0;
  if (clinicId) {
    const catalog = await query<{ id: string; name: string; slug: string }>(
      `SELECT id, name, slug FROM concerns WHERE is_active = true`
    );
    const cat = catalog.map((c) => ({ id: c.id, name: c.name, slug: c.slug, aliases: [] as string[] }));
    const seen = new Set<string>();
    for (const raw of p.concerns ?? []) {
      const name = (raw ?? "").trim();
      if (!name || isConcernNoise(name)) continue;
      const n = normalize(name);
      let row = cat.find((c) => normalize(c.name) === n || normalize(c.slug) === n);
      if (!row) { const fz = bestCatalogMatch(name, cat, 0.84); if (fz) row = cat.find((c) => c.slug === fz.entry.slug); }
      if (!row) row = coreRowFor("concern", [name], (slug) => cat.find((c) => c.slug === slug) ?? null) ?? undefined;
      if (!row && isCatalogClosed()) continue;
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
         WHERE clinic_concerns.source NOT IN ('removed', 'manual')`, [clinicId, row.id]);
      concernsSaved++;
    }
  }

  return {
    domain, status: "saved", slug: saved.clinics[0]?.slug, clinicId,
    treatments: services.length, matched: saved.servicesMatched,
    concernsSaved, providers: bundle.providers?.length ?? 0,
    cover: coverUrl ? "yes" : "NONE",
    rating: rating ? `${rating.rating}★/${rating.reviewCount ?? "?"} (${rating.source})` : null,
    g99: g99 ? `${g99.g99_clinic_id}/${g99.g99_business_id}` : null,
    ...(imgDropped.length ? { imagesDropped: imgDropped } : {}),
  };
}
