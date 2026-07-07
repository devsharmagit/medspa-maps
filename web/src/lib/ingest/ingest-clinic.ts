/**
 * ingest/ingest-clinic.ts — ingest ONE clinic website into the medspa-map DB.
 *
 * WEBSITE-ONLY pipeline (basic details + multi-location; NO treatments/
 * providers/reviews, and NO G99 database lookups):
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
 * The domain to ingest is chosen upstream (scripts/ingest-g99-batch.ts reads the
 * g99_clinic_websites harvest table). This module never queries G99.
 */

import type { CheerioAPI } from "cheerio";
import { fetchHtml, load, normalizeUrl } from "@/lib/scraper/utils";
import { extractImages } from "@/lib/scraper/images";
import { parseUSAddress, stateFullName } from "@/lib/address-parser";
import { firstNonEmpty } from "@/lib/g99/overlay";
import { geocodeAddress } from "@/lib/geocoder";
import { collectMapsLinks } from "@/lib/scraper/contact";
import { pickMapsLink } from "@/lib/scraper/locations";
import {
  saveClinicBundle,
  type ClinicBundle,
  type SaveClinicLevel,
  type SaveLocation,
  type SaveImages,
} from "@/lib/admin/clinic-save";
import { ESCALATION_MODEL } from "@/lib/ai/anthropic";
import {
  extractClinicDetails,
  type ExtractedClinic,
  type ExtractedLocation,
} from "@/lib/ingest/ai-extract";
import { discoverContentPages } from "@/lib/ingest/discover";

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
  modelUsed: string;
  escalated: boolean;
  note?: string;
}

/** Strip tags to plain text; tags → spaces so words/addresses never run together. */
function htmlToText($: CheerioAPI): string {
  $("script,style,noscript,svg,iframe,head").remove();
  const html = $("body").html() ?? $.html() ?? "";
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
    hours: x.hours ? { text: x.hours } : null,
  };
}

const aiToLoc = (l: ExtractedLocation): SaveLocation => toSaveLocation(l);

export async function ingestClinicByDomain(domain: string): Promise<IngestResult> {
  const base: IngestResult = {
    domain,
    status: "failed",
    locations: 0,
    geocoded: 0,
    images: 0,
    aiLocations: 0,
    g99Locations: 0,
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
  for (const u of await discoverContentPages($home, finalUrl)) {
    const r = await fetchHtml(u);
    if (!r) continue;
    const $p = load(r.html);
    pages.push({ url: u, text: htmlToText($p) });
    mapsPool.push(...collectMapsLinks($p));
  }

  // 2) AI extraction — website is the ONLY source (escalate once on failure /
  //    when zero locations come back).
  let extracted: ExtractedClinic;
  let modelUsed: string;
  let escalated = false;
  try {
    const out = await extractClinicDetails({ domain, pages });
    extracted = out.data;
    modelUsed = out.model;
  } catch {
    const out = await extractClinicDetails({ domain, pages, model: ESCALATION_MODEL });
    extracted = out.data;
    modelUsed = out.model;
    escalated = true;
  }
  let aiLocs = extracted.locations.map(aiToLoc);
  if (!escalated && aiLocs.length === 0) {
    const out = await extractClinicDetails({ domain, pages, model: ESCALATION_MODEL });
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

  // 4) images (heuristic, free) → logo + hero/cover (+ gallery)
  const businessName = firstNonEmpty(extracted.business_name) ?? undefined;
  const cityHint = firstNonEmpty(merged[0]?.city) ?? undefined;
  const imgs = extractImages($home, finalUrl, businessName, cityHint);
  const logo = imgs.find((i) => i.role === "logo");
  const cover = imgs.find((i) => i.role === "cover");
  const galleryImgs = imgs.filter((i) => i.role === "gallery");
  const images: SaveImages = {
    logo: logo ? { source_url: logo.source_url, alt_text: logo.alt_text ?? null } : null,
    // cover first → persisted as role 'cover' (the hero); the rest as 'gallery'.
    gallery: [
      ...(cover ? [{ source_url: cover.source_url, alt_text: cover.alt_text ?? null }] : []),
      ...galleryImgs.map((g) => ({ source_url: g.source_url, alt_text: g.alt_text ?? null })),
    ],
  };

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
  //    (no primary); no services / reviews this phase.
  const clinic: SaveClinicLevel = {
    booking_url: extracted.booking_url,
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
    services: [],
    reviews: [],
    images,
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
    modelUsed,
    escalated,
  };
}
