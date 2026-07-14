/**
 * ingest/ingest-clinic.ts — ingest ONE clinic's DETAILS into the medspa-map DB.
 *
 * WEBSITE-ONLY pipeline (basic details + multi-location + providers + images;
 * NO reviews, and NO G99 database lookups):
 *   1. Fetch homepage + discovered locations/contact/about pages → cleaned text,
 *      and collect every Google-Maps anchor link on those pages.
 *   2. AI extract basic details + ALL physical locations (Claude, forced-tool
 *      JSON). The website is the ONLY source of truth.
 *   3. Dedupe locations; attach each location's on-page Google-Maps anchor href
 *      (its "get directions" link) as the location URL.
 *   4. extractImages() heuristic → logo + hero/cover (+ gallery); free, no vision.
 *   5. Geocode each location (Nominatim).
 *   6. saveClinicBundle() — clinic-wide fields (booking/socials/about) live on the
 *      clinic; every location is independent (no primary); state stored full-name.
 *
 * Treatments/services are DELIBERATELY NOT extracted here — run
 * ingestServicesByDomain() (ingest/ingest-services.ts) separately, for the same
 * reason concerns are separate: so treatments can be re-scraped/re-resolved on
 * their own, without re-touching a clinic's details, and vice versa. For a
 * brand-new clinic, run this first (it creates the clinic), then
 * ingestServicesByDomain(), then optionally ingestConcernsByDomain() (which
 * requires services to already exist). See ingest/ingest-treatments-concerns.ts
 * for a single call that does both of the latter two.
 *
 * The domain to ingest is chosen upstream (scripts/ingest-g99-batch.ts reads the
 * g99_clinic_websites harvest table). This module never queries G99.
 */

import type { CheerioAPI } from "cheerio";
import { query } from "@/lib/db";
import { fetchHtml, load, normalizeUrl } from "@/lib/scraper/utils";
import { extractImages, collectImageCandidates, type ImageCandidate } from "@/lib/scraper/images";
import { isLandscapeImage } from "@/lib/scraper/image-size";
import { extractProviders } from "@/lib/scraper/providers";
import { parseUSAddress, stateFullName } from "@/lib/address-parser";
import { firstNonEmpty } from "@/lib/g99/overlay";
import { geocodeAddress } from "@/lib/geocoder";
import {
  collectMapsLinks,
  extractBookingUrl,
  extractHours,
  collectBookingLinkCandidates,
} from "@/lib/scraper/contact";
import { pickMapsLink } from "@/lib/scraper/locations";
import {
  saveClinicBundle,
  type ClinicBundle,
  type SaveClinicLevel,
  type SaveLocation,
  type SaveImages,
  type SaveProvider,
} from "@/lib/admin/clinic-save";
import { ESCALATION_MODEL } from "@/lib/ai/anthropic";
import {
  extractClinicDetails,
  type ExtractedClinic,
  type ExtractedLocation,
} from "@/lib/ingest/ai-extract";
import { discoverContentPages } from "@/lib/ingest/discover";
import {
  newBeforeAfterCandidates,
  scanPageForBeforeAfter,
  resolveBeforeAfter,
} from "@/lib/ingest/before-after";

const GALLERY_PHOTO_CAP = 5;
const PROVIDER_CAP = 10;

export interface IngestResult {
  domain: string;
  status: "saved" | "skipped" | "failed";
  clinicId?: string;
  slug?: string;
  locations: number;
  geocoded: number;
  images: number;
  aiLocations: number;
  g99Locations: number;
  providers?: number;
  beforeAfter?: number;
  modelUsed: string;
  escalated: boolean;
  note?: string;
}

/**
 * Optional G99 provenance to stamp onto the saved business/clinic. This module
 * NEVER queries G99 itself (website-only invariant) — the caller (e.g. the admin
 * "Add website with AI" route) does the harvest-table lookup and passes the ids
 * in, and saveClinicBundle applies the stamp.
 */
export interface IngestOptions {
  /** Disable vision calls for targeted treatment/location repair runs. */
  useVision?: boolean;
  g99?: {
    g99_clinic_id?: string | number | null;
    g99_business_id?: string | number | null;
    g99_tenant_id?: string | number | null;
    google_place_id?: string | null;
  };
}

/** Strip tags to plain text; tags → spaces so words/addresses never run together.
 *  Operates on a DETACHED clone: the same $home is reused for image extraction,
 *  which needs <head>/<style>/<script> intact (og:image, CSS-background heroes,
 *  preload-hero links, schema.org logo). Mutating it here silently gutted the
 *  cover/logo detection. */
export function htmlToText($: CheerioAPI): string {
  const $c = load($.html());
  $c("script,style,noscript,svg,iframe,head").remove();
  const html = $c("body").html() ?? $c.html() ?? "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#0?38;/g, "&")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function locKey(l: SaveLocation): string {
  if (l.zip) return `z:${l.zip}`;
  if (l.city) return `c:${l.city.toLowerCase().trim()}|${(l.state ?? "").toLowerCase()}`;
  if (l.address) return `a:${l.address.toLowerCase().replace(/\s+/g, " ").trim()}`;
  return "";
}

function toSaveLocation(x: {
  label?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  phone?: string | null;
  hours?: string | null;
}): SaveLocation {
  const parsed = x.address ? parseUSAddress(x.address) : null;
  return {
    tagline: firstNonEmpty(x.label),
    address: firstNonEmpty(x.address),
    city: firstNonEmpty(x.city, parsed?.city),
    // Store the FULL state name ("Texas"), not the abbreviation.
    state: firstNonEmpty(stateFullName(x.state), stateFullName(parsed?.state)),
    zip: firstNonEmpty(x.zip, parsed?.zip),
    phone: firstNonEmpty(x.phone),
    // Booking is clinic-wide, never per location.
    booking_url: null,
    // Hours are attached later from the heuristic DOM parse — the AI free-text
    // hours are unreliable and mis-shaped for the UI.
    hours: null,
  };
}

const aiToLoc = (l: ExtractedLocation): SaveLocation => toSaveLocation(l);

const DAYS7 = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
/** Convert the AI's working_hours array to the canonical {DAY:{open,close,is_open}} map. */
function hoursArrayToMap(
  arr: Array<{ day: string; open: string | null; close: string | null; is_open: boolean }> | undefined
): Record<string, { open: string | null; close: string | null; is_open: boolean }> | null {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const map: Record<string, { open: string | null; close: string | null; is_open: boolean }> = {};
  for (const h of arr) {
    const day = String(h?.day ?? "").toUpperCase().trim();
    if (!DAYS7.includes(day) || map[day]) continue;
    const isOpen = !!h.is_open && !!h.open && !!h.close;
    map[day] = { open: isOpen ? h.open : null, close: isOpen ? h.close : null, is_open: isOpen };
  }
  return Object.keys(map).length ? map : null;
}

export async function ingestClinicByDomain(
  domain: string,
  opts: IngestOptions = {}
): Promise<IngestResult> {
  const base: IngestResult = {
    domain,
    status: "failed",
    locations: 0,
    geocoded: 0,
    images: 0,
    aiLocations: 0,
    g99Locations: 0,
    providers: 0,
    modelUsed: "",
    escalated: false,
  };

  // 1) fetch homepage + content pages; collect maps-link anchors from each DOM
  const homeUrl = normalizeUrl(domain);
  const home = await fetchHtml(homeUrl);
  if (!home) return { ...base, status: "skipped", note: "homepage unreachable" };
  const $home = load(home.html);
  const finalUrl = home.finalUrl || homeUrl;

  const pages: Array<{ url: string; text: string }> = [
    { url: finalUrl, text: htmlToText($home) },
  ];
  const mapsPool = collectMapsLinks($home);
  // Candidates the AI chooses from — cheerio only gathers the material (image
  // URLs + booking links); the LLM makes every judgement (which image is the
  // cover/logo/gallery, which link is booking). Heuristics are kept as FALLBACK.
  const imageCandidates = collectImageCandidates($home, finalUrl);
  const bookingCandidates = collectBookingLinkCandidates($home, finalUrl);
  // Provider headshots live on the team/about pages, so build the provider
  // image-candidate list from CONTENT pages FIRST and use the homepage only as
  // filler — otherwise homepage hero/gallery images crowd the team page out
  // under the cap (which left many providers with no matchable headshot).
  const providerImageCandidates: ImageCandidate[] = [];
  const PROV_CAND_CAP = 80;
  const addProvCands = (list: ImageCandidate[]) => {
    for (const c of list) {
      if (providerImageCandidates.length >= PROV_CAND_CAP) break;
      if (!providerImageCandidates.some((x) => x.url === c.url)) providerImageCandidates.push(c);
    }
  };
  const hProviders = extractProviders($home, finalUrl);
  let hBooking = extractBookingUrl($home, finalUrl);
  let hHours = extractHours($home, home.html);

  // Before/after candidates — collected across all pages, resolved after images.
  // Homepage contributes only filename-certain matches (isHome suppresses the
  // gallery sweep). Classification rules live in ingest/before-after.ts.
  const baCands = newBeforeAfterCandidates();
  scanPageForBeforeAfter(baCands, $home, finalUrl, { isHome: true, candidates: imageCandidates });

  for (const u of await discoverContentPages($home, finalUrl)) {
    const r = await fetchHtml(u);
    if (!r) continue;
    const $p = load(r.html);
    pages.push({ url: u, text: htmlToText($p) });
    mapsPool.push(...collectMapsLinks($p));
    for (const c of collectBookingLinkCandidates($p, u)) {
      if (!bookingCandidates.some((b) => b.href === c.href)) bookingCandidates.push(c);
    }
    const pageImgs = collectImageCandidates($p, u);
    addProvCands(pageImgs);
    hProviders.push(...extractProviders($p, u));
    scanPageForBeforeAfter(baCands, $p, u, { candidates: pageImgs });
    if (!hBooking) hBooking = extractBookingUrl($p, u);
    if (!hHours) hHours = extractHours($p, r.html);
  }
  addProvCands(imageCandidates); // homepage images as filler (some sites list team on home)

  // 2) AI extraction — website is the ONLY source (escalate once on failure /
  //    when zero locations come back).
  const aiInput = {
    domain, pages, imageCandidates, bookingCandidates, providerImageCandidates,
    useVision: opts.useVision,
  };
  let extracted: ExtractedClinic;
  let modelUsed: string;
  let escalated = false;
  try {
    const out = await extractClinicDetails(aiInput);
    extracted = out.data;
    modelUsed = out.model;
  } catch {
    // Escalate text-only: a hotlink-blocked/4xx image URL can 400 the vision
    // request, so the retry must not resend images.
    const out = await extractClinicDetails({ ...aiInput, model: ESCALATION_MODEL, useVision: false });
    extracted = out.data;
    modelUsed = out.model;
    escalated = true;
  }
  let aiLocs = extracted.locations.map(aiToLoc);
  if (!escalated && aiLocs.length === 0) {
    const out = await extractClinicDetails({ ...aiInput, model: ESCALATION_MODEL, useVision: false });
    extracted = out.data;
    modelUsed = out.model;
    escalated = true;
    aiLocs = extracted.locations.map(aiToLoc);
  }
  base.aiLocations = aiLocs.length;

  // 3) dedupe locations; attach each location's on-page maps anchor href
  const merged: SaveLocation[] = [];
  const byKey = new Map<string, SaveLocation>();
  for (const l of aiLocs) {
    const k = locKey(l) || `ai:${merged.length}`;
    if (!byKey.has(k)) {
      byKey.set(k, l);
      merged.push(l);
    }
  }
  if (merged.length === 0) merged.push({ booking_url: null });

  merged.forEach((loc, i) => {
    const picked = pickMapsLink(mapsPool, loc.address ?? null, loc.city ?? null, i);
    if (picked) loc.maps_url = picked;
  });

  // 4) images — the AI picks cover/logo/gallery from the candidate list; the
  //    heuristic extractor is the FALLBACK when the AI returns nothing/invalid.
  const businessName = firstNonEmpty(extracted.business_name) ?? undefined;
  const cityHint = firstNonEmpty(merged[0]?.city) ?? undefined;
  const hImgs = extractImages($home, finalUrl, businessName, cityHint);
  const hLogo = hImgs.find((i) => i.role === "logo");
  const hCover = hImgs.find((i) => i.role === "cover");
  const hGallery = hImgs.filter((i) => i.role === "gallery");

  const candUrls = new Set(imageCandidates.map((c) => c.url));
  const altOf = (u: string) => imageCandidates.find((c) => c.url === u)?.alt || null;
  const validImg = (u: string | null | undefined) => (u && candUrls.has(u) ? u : null);

  const logoUrl = validImg(extracted.logo_url) ?? hLogo?.source_url ?? null;
  let galleryUrls = (extracted.gallery_image_urls ?? []).filter((u) => candUrls.has(u));
  if (galleryUrls.length === 0) galleryUrls = hGallery.map((g) => g.source_url);

  // Cover DIMENSION check — the hero slot is landscape, so a portrait photo
  // (e.g. a 706x1024 "welcome pic") must never become the cover, regardless of
  // whether the AI or the heuristic picked it. Walk the ranked candidates (AI
  // pick → heuristic pick → AI gallery picks) and take the first that probes
  // landscape-or-square; unknown dims (unreachable/odd format) are accepted so
  // a flaky host can't wipe the cover. If everything probes portrait, fall back
  // to the original pick rather than shipping no cover at all.
  const coverRanked = [
    ...new Set(
      [validImg(extracted.cover_image_url), hCover?.source_url, ...galleryUrls].filter(
        (u): u is string => !!u && u !== logoUrl
      )
    ),
  ];
  // The hero slot is ~1.9:1, so demand a genuinely wide image (w/h ≥ 1.2) —
  // squares and portraits fall through to the gallery.
  let coverUrl: string | null = null;
  for (const u of coverRanked) {
    if ((await isLandscapeImage(u, { minRatio: 1.2 })) !== false) {
      coverUrl = u;
      break;
    }
  }
  if (!coverUrl) coverUrl = coverRanked[0] ?? null;

  galleryUrls = galleryUrls
    .filter((u) => u !== coverUrl && u !== logoUrl)
    .slice(0, GALLERY_PHOTO_CAP);

  const images: SaveImages = {
    logo: logoUrl ? { source_url: logoUrl, alt_text: altOf(logoUrl) } : null,
    // cover first → persisted as role 'cover' (the hero); the rest as 'gallery'.
    gallery: [
      ...(coverUrl ? [{ source_url: coverUrl, alt_text: altOf(coverUrl) }] : []),
      ...galleryUrls.map((u) => ({ source_url: u, alt_text: altOf(u) })),
    ],
  };

  // 4a) before/after — resolve the collected candidates (AI-classify the
  //     uncertain, de-dup vs cover/logo/gallery, cap). De-dup is load-bearing:
  //     the images unique key excludes role, so a URL already used as
  //     cover/gallery would make the before_after insert a silent no-op.
  const beforeAfter = await resolveBeforeAfter(baCands, {
    excludeUrls: [logoUrl, coverUrl, ...galleryUrls].filter((u): u is string => !!u),
    businessName,
    domain,
  });
  images.before_after = beforeAfter;

  // 4b) booking + hours — AI pick (validated against the candidate lists) first,
  //     heuristic fallback second.
  const bookHrefs = new Set(bookingCandidates.map((c) => c.href));
  const bookingUrl =
    (extracted.booking_url && bookHrefs.has(extracted.booking_url)
      ? extracted.booking_url
      : null) ??
    hBooking ??
    null;
  const hours = hoursArrayToMap(extracted.working_hours) ?? hHours ?? null;
  merged.forEach((loc) => {
    if (!loc.hours) loc.hours = hours;
  });

  // 4c) providers — AI picks name/title, an image (verbatim from candidates),
  //     and flags the owner; heuristic extractProviders is the fallback. Only
  //     the owner gets a card_tagline, which is also the owner-first sort key.
  const provCandUrls = new Set(providerImageCandidates.map((c) => c.url));
  const seenProv = new Set<string>();
  let providers: SaveProvider[] = (extracted.providers ?? [])
    .filter((p) => p.name?.trim())
    .map((p) => ({
      name: p.name.trim(),
      title: firstNonEmpty(p.title) ?? null,
      image_url: p.image_url && provCandUrls.has(p.image_url) ? p.image_url : null,
      card_tagline: p.is_owner ? firstNonEmpty(p.card_tagline) ?? null : null,
      is_verified: false,
    }))
    .filter((p) => {
      const k = p.name.toLowerCase();
      if (seenProv.has(k)) return false;
      seenProv.add(k);
      return true;
    });
  providers.sort((a, b) => (b.card_tagline ? 1 : 0) - (a.card_tagline ? 1 : 0));
  providers = providers.slice(0, PROVIDER_CAP);

  // Fallback: if the AI returned no providers, use the heuristic extractor.
  if (providers.length === 0 && hProviders.length > 0) {
    const seenH = new Set<string>();
    providers = hProviders
      .filter((p) => p.name?.trim())
      .filter((p) => {
        const k = p.name.toLowerCase();
        if (seenH.has(k)) return false;
        seenH.add(k);
        return true;
      })
      .map((p) => ({
        name: p.name.trim(),
        title: firstNonEmpty(p.title, p.designation) ?? null,
        image_url: firstNonEmpty(p.photo_url) ?? null,
        card_tagline: null,
        is_verified: false,
      }))
      .slice(0, PROVIDER_CAP);
  }

  // 5) geocode each location missing coordinates (Nominatim, rate-limited).
  //    Full street addresses with suite/unit tokens frequently miss, so fall
  //    back to a city-level "City, State ZIP" query (the full state name
  //    resolves fine on Nominatim).
  let geocoded = 0;
  const clean = (parts: Array<string | null | undefined>) =>
    parts.map((p) => (p ? String(p).trim() : "")).filter(Boolean).join(", ");
  for (const loc of merged) {
    if (loc.lat != null && loc.lng != null) {
      geocoded++;
      continue;
    }
    const full = clean([loc.address, loc.city, loc.state, loc.zip]);
    const cityLevel = clean([loc.city, loc.state, loc.zip]);
    let geo = full.length >= 5 ? await geocodeAddress(full) : null;
    if (!geo && cityLevel.length >= 5 && cityLevel !== full) {
      geo = await geocodeAddress(cityLevel);
    }
    if (geo) {
      loc.lat = geo.lat;
      loc.lng = geo.lng;
      geocoded++;
    }
  }

  // 6) persist — clinic-wide fields on the clinic; every location independent
  //    (no primary); services mapped to canonical treatments; no reviews.
  const clinic: SaveClinicLevel = {
    booking_url: bookingUrl,
    hours: hours,
    about: firstNonEmpty(extracted.about, extracted.tagline),
    tagline: extracted.tagline,
    email: extracted.email,
    phone: extracted.phone,
    instagram_url: extracted.instagram_url,
    facebook_url: extracted.facebook_url,
    tiktok_url: extracted.tiktok_url,
    youtube_url: extracted.youtube_url,
    x_url: extracted.x_url,
    linkedin_url: extracted.linkedin_url,
    yelp_url: extracted.yelp_url,
  };

  const bundle: ClinicBundle = {
    website: finalUrl,
    business: { name: firstNonEmpty(extracted.business_name, domain) ?? domain },
    clinic,
    locations: merged,
    // services intentionally OMITTED — this pipeline no longer extracts
    // treatments (see ingest/ingest-services.ts); omitting the field (vs. [])
    // means saveClinicBundle leaves clinic_services completely untouched, so a
    // details-only re-ingest can never wipe out a clinic's treatments.
    reviews: [],
    images,
    providers,
    // G99 provenance (optional) — stamped by saveClinicBundle when the caller
    // supplied a harvest-table match; absent for a plain website-only ingest.
    ...(opts.g99 ?? {}),
  };
  const saved = await saveClinicBundle(bundle, { overwrite: true });

  return {
    ...base,
    status: "saved",
    clinicId: saved.clinics[0]?.id,
    slug: saved.clinics[0]?.slug,
    locations: merged.length,
    geocoded,
    images: saved.images,
    providers: providers.length,
    beforeAfter: beforeAfter.length,
    modelUsed,
    escalated,
  };
}
