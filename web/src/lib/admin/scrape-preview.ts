/**
 * admin/scrape-preview.ts — scrape a website into a SAVE-READY preview.
 *
 * scrapeClinicPreview(url) runs the shared scraper (scrapeWebsite +
 * extractServiceAnchors + extractReviews + extractBeforeAfter) and assembles a
 * payload in the exact shape saveClinicBundle() consumes — WITHOUT persisting
 * anything. The admin UI shows this for review/editing before a save.
 *
 * It additionally returns a `duplicate` block describing any existing clinics
 * that already match this website's domain, so the UI can warn about overwrites.
 *
 * Providers and pricing are intentionally omitted.
 */

import { scrapeWebsite } from "@/lib/scraper";
import { fetchHtml, load, normalizeUrl, parseAddress } from "@/lib/scraper/utils";
import { sanitizeMapsUrl, mapsUrlQuality } from "@/lib/scraper/contact";
import { extractServiceAnchors } from "@/lib/scraper/services";
import { extractReviews, type ScrapedReview } from "@/lib/scraper/reviews";
import { extractBeforeAfter } from "@/lib/scraper/beforeafter";
import type {
  ScrapedService,
  ScrapedImage,
} from "@/lib/scraper/types";
import { matchService, isLikelyNoise } from "@/lib/taxonomy/canonical";
import {
  computePriorityCoverage,
  type PriorityCoverage,
} from "@/lib/treatments/coverage";
import {
  websiteDomain,
  findClinicsByDomain,
  type SaveLocation,
  type SaveService,
  type SaveReview,
  type SaveImages,
  type SaveImageRef,
} from "@/lib/admin/clinic-save";
export interface PreviewDuplicate {
  exists: boolean;
  clinicIds: string[];
  byDomain: string;
}

export interface ClinicPreview {
  website: string;
  business: { name: string };
  locations: SaveLocation[];
  services: SaveService[];
  /** concern slugs the clinic's mapped priority treatments can treat */
  concerns: string[];
  /** how many of the 15 Phase-0 priority treatments this clinic offers */
  coverage: PriorityCoverage;
  images: SaveImages;
  reviews: SaveReview[];
  ext_rating: number | null;
  ext_review_count: number | null;
  duplicate: PreviewDuplicate;
}

const GALLERY_PATHS = [
  "/before-and-after-treatment-images/",
  "/before-and-after/",
  "/before-after/",
  "/gallery/",
];

const MAPS_SELECTOR =
  "a[href*='maps.app.goo.gl'], a[href*='goo.gl/maps'], a[href*='google.com/maps'], a[href*='maps.google.com']";

/** A stable key for a Google Maps destination — its place name, else rounded coords. */
function mapsPlaceKey(u: string): string {
  const place = u.match(/\/place\/([^/@]+)/);
  if (place) {
    return decodeURIComponent(place[1])
      .replace(/\+/g, " ")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, "");
  }
  const at = u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return `${(+at[1]).toFixed(2)},${(+at[2]).toFixed(2)}`;
  const q = u.match(/[?&](?:q|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (q) return `${(+q[1]).toFixed(2)},${(+q[2]).toFixed(2)}`;
  return u.toLowerCase();
}

/**
 * Inspect a site's footer Google Maps links and return:
 *   - placeCount: the number of DISTINCT physical destinations (a pin link + a
 *     directions link to the same place collapse to one) — the most reliable
 *     signal for "how many real addresses exist".
 *   - bestUrl: the single highest-quality usable maps link (short link / place
 *     URL preferred), used to backfill a location whose own maps link is broken.
 * Coordinate-only / broken URLs are filtered out. Returns zeros/null when the
 * footer has no usable maps links (caller falls back to address-based dedup).
 */
async function footerMaps(
  homeUrl: string
): Promise<{ placeCount: number; bestUrl: string | null }> {
  const r = await fetchHtml(homeUrl);
  if (!r) return { placeCount: 0, bestUrl: null };
  const $ = load(r.html);
  let nodes = $("footer").find(MAPS_SELECTOR);
  if (nodes.length === 0) nodes = $(MAPS_SELECTOR); // some sites have no <footer>
  const hrefs: string[] = [];
  const seen = new Set<string>();
  nodes.each((_, el) => {
    const h = ($(el).attr("href") ?? "").trim();
    if (h && !seen.has(h) && sanitizeMapsUrl(h)) {
      seen.add(h);
      hrefs.push(h);
    }
  });
  if (hrefs.length === 0) return { placeCount: 0, bestUrl: null };

  const bestUrl =
    [...hrefs].sort((a, b) => mapsUrlQuality(b) - mapsUrlQuality(a))[0] ?? null;

  // Resolve (follow redirects) in parallel, with a per-link timeout.
  const keys = await Promise.all(
    hrefs.slice(0, 12).map(async (h) => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        const res = await fetch(h, {
          redirect: "follow",
          signal: ctrl.signal,
          headers: { "user-agent": "Mozilla/5.0" },
        });
        clearTimeout(t);
        return mapsPlaceKey(res.url || h);
      } catch {
        return mapsPlaceKey(h);
      }
    })
  );
  return { placeCount: new Set(keys).size, bestUrl };
}

/** Keep the `n` most-complete locations (address/city/state/zip), preserving order. */
function pickMostComplete(locs: SaveLocation[], n: number): SaveLocation[] {
  const score = (l: SaveLocation) =>
    (l.address ? 1 : 0) + (l.city ? 1 : 0) + (l.state ? 1 : 0) + (l.zip ? 1 : 0);
  return locs
    .map((loc, i) => ({ loc, i, s: score(loc) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, n)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.loc);
}

/**
 * Build the cleaned, deduped service list: scraper services + anchor services
 * from the homepage and /services/. Dedupe by lowercased name.
 */
async function buildServices(
  siteUrl: string,
  scraped: ScrapedService[]
): Promise<ScrapedService[]> {
  const anchors: ScrapedService[] = [];
  for (const pageUrl of [siteUrl, `${siteUrl}/services/`]) {
    const r = await fetchHtml(pageUrl);
    if (!r) continue;
    anchors.push(...extractServiceAnchors(load(r.html), siteUrl));
  }
  const seen = new Set<string>();
  const merged: ScrapedService[] = [];
  for (const s of [...scraped, ...anchors]) {
    const name = s.name?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    if (s.is_category) continue;
    seen.add(key);
    merged.push(s);
  }
  return merged;
}

/**
 * scrapeClinicPreview(url) — scrape into a save-ready preview payload + a
 * duplicate block (matched by website domain against existing clinics).
 */
export async function scrapeClinicPreview(url: string): Promise<ClinicPreview> {
  const siteUrl = normalizeUrl(url);
  const domain = websiteDomain(siteUrl);

  const scrape = await scrapeWebsite(siteUrl);
  const c = scrape.contact;
  const bizName = c.name || domain;

  // ── locations (one SaveLocation per DISTINCT physical site) ────────────────
  // City/state/zip are derived from the parsed address (the reliable source) —
  // never from marketing prose. Locations sharing the same city+state+zip are
  // collapsed (the first/footer occurrence wins), so a site with one footer
  // address can't be split into phantom duplicates.
  const scrapedLocations =
    scrape.locations.length > 0 ? scrape.locations : [{}];
  const isMulti = scrapedLocations.length > 1;
  const builtLocations = scrapedLocations.map((loc, i) => {
    const address = loc.address ?? c.address ?? null;
    const parsed = address
      ? parseAddress(address)
      : { city: null, state: null, zip: null, street: null };
    const city = pickCity(parsed.city, loc.city, c.city);
    const saveLoc: SaveLocation = {
      // Multi-location sites: prefill each location's name/tagline from its
      // scraped heading (or city) so it isn't blank in the wizard. Generic
      // section headings ("Our Offices", "Locations") are rejected — better a
      // blank tagline the admin fills than a wrong one.
      tagline: isMulti ? (cleanLocationName(loc.name) ?? city ?? null) : null,
      address,
      city,
      state: parsed.state ?? loc.state ?? c.state ?? null,
      zip: parsed.zip ?? loc.zip ?? c.zip ?? null,
      lat: loc.lat ?? c.lat ?? null,
      lng: loc.lng ?? c.lng ?? null,
      phone: loc.phone ?? c.phone ?? null,
      email: loc.email ?? c.email ?? null,
      about: c.about ?? null,
      booking_url: c.booking_url ?? null,
      maps_url: loc.maps_url ?? null,
      hours: (loc.hours ?? c.hours ?? null) as Record<string, unknown> | null,
      instagram_url: c.instagram_url ?? null,
      facebook_url: c.facebook_url ?? null,
      tiktok_url: c.tiktok_url ?? null,
      youtube_url: c.youtube_url ?? null,
      x_url: c.x_url ?? null,
      linkedin_url: c.linkedin_url ?? null,
      yelp_url: c.yelp_url ?? null,
      google_my_business: c.google_my_business ?? null,
    };
    // Dedup key uses ONLY values parsed from the address, and only when all
    // three are present — so genuinely distinct locations whose addresses the
    // scraper couldn't parse (null city/zip) are never collapsed. Same key =
    // same physical site (e.g. a footer address echoed elsewhere).
    const key =
      parsed.city && parsed.state && parsed.zip
        ? `${parsed.city.trim().toLowerCase()}|${parsed.state}|${parsed.zip}`
        : `__row_${i}__`;
    return { saveLoc, key };
  });
  let locations = dedupeLocations(builtLocations);
  // Authoritative cap: the number of DISTINCT Google Maps destinations linked in
  // the footer is the most reliable count of real locations. If address-based
  // dedup still left more locations than the site actually advertises (e.g. a
  // stray second address echoed on the page), trim to the footer count. A maps
  // resolution failure returns 0 → no trim → address dedup stands.
  const { placeCount: mapsPlaceCount, bestUrl: pageBestMapsUrl } =
    await footerMaps(siteUrl);
  if (mapsPlaceCount >= 1 && locations.length > mapsPlaceCount) {
    locations = pickMostComplete(locations, mapsPlaceCount);
  }

  // Normalize each location's maps link: drop broken coordinate-only URLs and
  // prefer the real footer link. The footer short link (maps.app.goo.gl/…) is
  // authoritative for a single-location site; multi-location keeps each
  // location's own link. Stored verbatim — we do NOT expand short links.
  const singleLocation = locations.length === 1;
  locations = locations.map((loc) => {
    const own = sanitizeMapsUrl(loc.maps_url);
    const mu = singleLocation
      ? (pageBestMapsUrl ?? own ?? null)
      : (own ?? pageBestMapsUrl ?? null);
    return { ...loc, maps_url: mu };
  });

  // ── services with suggestion + is_noise ────────────────────────────────────
  const rawServices = await buildServices(siteUrl, scrape.services);
  const services: SaveService[] = rawServices.map((s) => {
    const raw = s.name.trim();
    const m = matchService(raw);
    return {
      raw_name: raw,
      description: s.description ?? null,
      scraped_from_url: s.scraped_from_url ?? null,
      suggestion: m.slug ? { slug: m.slug, confidence: m.confidence } : null,
      is_noise: isLikelyNoise(raw),
    };
  });

  // ── priority-treatment coverage + treatable concerns ───────────────────────
  // Phase 0: only services that resolve to one of the 15 priority treatments
  // count. The concerns surfaced are exactly those the mapped treatments can
  // treat (per the curated concern↔service map).
  const matchedSlugs = services
    .filter((s) => !s.is_noise && s.suggestion?.slug)
    .map((s) => s.suggestion!.slug);
  const coverage = computePriorityCoverage(matchedSlugs);
  const concerns = coverage.concerns.map((c) => c.slug);

  // ── images ─────────────────────────────────────────────────────────────────
  const logoImg = scrape.images.find((i) => i.role === "logo");
  const galleryImgs = scrape.images.filter(
    (i) => i.role === "gallery" || i.role === "cover"
  );

  const baImgs: ScrapedImage[] = [];
  const baSeen = new Set<string>();
  for (const path of GALLERY_PATHS) {
    const r = await fetchHtml(siteUrl + path);
    if (!r) continue;
    for (const img of extractBeforeAfter(load(r.html), siteUrl + path)) {
      if (baSeen.has(img.source_url)) continue;
      baSeen.add(img.source_url);
      baImgs.push(img);
    }
  }

  const toRef = (img: ScrapedImage): SaveImageRef => ({
    source_url: img.source_url,
    alt_text: img.alt_text ?? null,
  });
  const images: SaveImages = {
    logo: logoImg ? toRef(logoImg) : null,
    gallery: galleryImgs.map(toRef),
    before_after: baImgs.map(toRef),
  };

  // ── reviews + aggregate ────────────────────────────────────────────────────
  let scrapedReviews: ScrapedReview[] = [];
  let aggregate: { rating: number; count: number | null } | undefined;
  const reviewsPage = await fetchHtml(`${siteUrl}/reviews/`);
  if (reviewsPage) {
    const ext = extractReviews(load(reviewsPage.html), `${siteUrl}/reviews/`);
    scrapedReviews = ext.reviews;
    aggregate = ext.aggregate;
  }
  const reviews: SaveReview[] = scrapedReviews.map((r) => ({
    reviewer_name: r.reviewer_name ?? null,
    rating: r.rating ?? null,
    body: r.body,
    source_url: r.source_url ?? null,
  }));

  // ── duplicate block (website-domain match against existing clinics) ────────
  const clinicIds = await findClinicsByDomain(domain);
  const duplicate: PreviewDuplicate = {
    exists: clinicIds.length > 0,
    clinicIds,
    byDomain: domain,
  };

  return {
    website: siteUrl,
    business: { name: bizName },
    locations,
    services,
    concerns,
    coverage,
    images,
    reviews,
    ext_rating: aggregate ? Math.min(5, Math.max(0, aggregate.rating)) : null,
    ext_review_count: aggregate?.count ?? null,
    duplicate,
  };
}

/** Reject generic section headings ("Our Offices", "Locations", …) that get
 * scraped as a location name — they make poor, often duplicated, taglines. */
const GENERIC_LOCATION_NAME =
  /^(our\s+)?(office|offices|location|locations|address(?:es)?|contact(?:\s+us)?|visit\s+us|find\s+us|get\s+in\s+touch|hours|directions)$/i;
function cleanLocationName(name?: string | null): string | null {
  const n = name?.trim();
  if (!n || GENERIC_LOCATION_NAME.test(n)) return null;
  return n;
}

/** True if a "city" value is actually marketing prose, not a city name. */
function looksLikeProse(value: string | null | undefined): boolean {
  if (!value) return true;
  const v = value.trim();
  if (v.length > 30) return true;
  if (v.split(/\s+/).length > 3) return true;
  return /\b(premier|destination|heart|welcome|located|serving|experience|best|your|our|leading|trusted|top|home of)\b/i.test(v);
}

/** Pick the first non-prose city candidate; parsed (from address) is most reliable. */
function pickCity(...candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    if (c && !looksLikeProse(c)) return c.trim();
  }
  return null;
}

/**
 * Collapse locations that refer to the same physical site. The key is derived
 * ONLY from the address-parsed city+state+zip (and only when all three are
 * present); rows whose address couldn't be parsed get a unique key and are
 * never merged. The first occurrence (typically the footer address) wins, and
 * we backfill any field it's missing from the duplicate.
 */
function dedupeLocations(
  rows: { saveLoc: SaveLocation; key: string }[]
): SaveLocation[] {
  const out: SaveLocation[] = [];
  const byKey = new Map<string, SaveLocation>();
  for (const { saveLoc, key } of rows) {
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, saveLoc);
      out.push(saveLoc);
    } else {
      for (const k of Object.keys(saveLoc) as (keyof SaveLocation)[]) {
        if (existing[k] == null && saveLoc[k] != null) {
          (existing as Record<string, unknown>)[k] = saveLoc[k];
        }
      }
    }
  }
  return out;
}

