/**
 * ingest/ingest-clinic.ts — ingest ONE G99 domain into the medspa-map DB.
 *
 * Pipeline (basic details + multi-location only; NO treatments/providers/reviews):
 *   1. Load this domain's row from g99_clinic_websites (clinic-id + business-id arrays).
 *   2. Fetch those clinics LIVE from G99 prod (fallback data + location hints).
 *   3. Fetch homepage + discovered locations/contact/about pages → cleaned text.
 *   4. extractImages() heuristic → logo + cover (free; no vision model).
 *   5. AI extract basic details + ALL locations (Claude, forced-tool JSON).
 *   6. Merge: union of AI locations + G99 clinic addresses (dedupe); gap-fill each
 *      field AI missed from G99; attach business-level socials/about/booking to
 *      the primary location.
 *   7. Geocode each location (Nominatim).
 *   8. saveClinicBundle() with services:[] / reviews:[].
 *
 * If G99 prod is unreachable, ingest still runs AI-only (no G99 fallback).
 */

import type { CheerioAPI } from "cheerio";
import { queryOne } from "@/lib/db";
import { fetchHtml, load, normalizeUrl } from "@/lib/scraper/utils";
import { extractImages } from "@/lib/scraper/images";
import { parseUSAddress, normalizeState } from "@/lib/address-parser";
import { firstNonEmpty } from "@/lib/g99/overlay";
import { geocodeAddress } from "@/lib/geocoder";
import {
  getProdClinicsByIds,
  getProdBusiness,
  type ProdG99Clinic,
  type ProdG99Business,
} from "@/lib/g99/prod";
import {
  saveClinicBundle,
  type ClinicBundle,
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

interface WebsiteRow {
  g99_clinic_ids: string[];
  g99_business_ids: string[];
  clinic_name: string | null;
  business_name: string | null;
}

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
    state: firstNonEmpty(normalizeState(x.state), parsed?.state),
    zip: firstNonEmpty(x.zip, parsed?.zip),
    phone: firstNonEmpty(x.phone),
    hours: x.hours ? { text: x.hours } : null,
  };
}

const aiToLoc = (l: ExtractedLocation): SaveLocation => toSaveLocation(l);
const prodToLoc = (c: ProdG99Clinic): SaveLocation =>
  toSaveLocation({ label: c.name, address: c.address, city: c.city, state: c.state, phone: c.contact_number });

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

  // 1) our harvest row (clinic-id + business-id arrays for this website)
  const row = await queryOne<WebsiteRow>(
    `SELECT g99_clinic_ids, g99_business_ids, clinic_name, business_name
       FROM g99_clinic_websites WHERE domain = $1`,
    [domain]
  );

  // 2) live G99 prod records (fallback + location hints); AI-only if prod is down
  let prodClinics: ProdG99Clinic[] = [];
  let prodBiz: ProdG99Business | null = null;
  if (row) {
    try {
      prodClinics = await getProdClinicsByIds(row.g99_clinic_ids ?? []);
      prodBiz = await getProdBusiness(row.g99_business_ids?.[0] ?? null).catch(() => null);
    } catch {
      /* prod unreachable → proceed AI-only */
    }
  }
  const rep: ProdG99Clinic | undefined = prodClinics[0];
  const repAddr = rep?.address ? parseUSAddress(rep.address) : null;
  const g99Locs: SaveLocation[] = prodClinics
    .filter((c) => (c.address && c.address.trim()) || c.city)
    .map(prodToLoc);
  base.g99Locations = g99Locs.length;

  // 3) fetch homepage + content pages
  const homeUrl = normalizeUrl(domain);
  const home = await fetchHtml(homeUrl);
  if (!home) return { ...base, status: "skipped", note: "homepage unreachable" };
  const $home = load(home.html);
  const finalUrl = home.finalUrl || homeUrl;

  const pages: Array<{ url: string; text: string }> = [
    { url: finalUrl, text: htmlToText($home) },
  ];
  for (const u of await discoverContentPages($home, finalUrl)) {
    const r = await fetchHtml(u);
    if (r) pages.push({ url: u, text: htmlToText(load(r.html)) });
  }

  // 4) images (heuristic, free) → logo + cover
  const businessName = firstNonEmpty(row?.business_name, prodBiz?.name, rep?.name) ?? undefined;
  const imgs = extractImages($home, finalUrl, businessName, repAddr?.city ?? undefined);
  const logo = imgs.find((i) => i.role === "logo");
  const cover = imgs.find((i) => i.role === "cover");
  const images: SaveImages = {
    logo: logo ? { source_url: logo.source_url, alt_text: logo.alt_text ?? null } : null,
    gallery: cover ? [{ source_url: cover.source_url, alt_text: cover.alt_text ?? null }] : [],
  };

  // 5) AI extraction (escalate once on failure / empty locations)
  const hints = {
    business_name: firstNonEmpty(row?.business_name, prodBiz?.name, rep?.name),
    city: firstNonEmpty(rep?.city, repAddr?.city),
    state: firstNonEmpty(normalizeState(rep?.state), repAddr?.state),
    phone: firstNonEmpty(rep?.contact_number),
  };
  let extracted: ExtractedClinic;
  let modelUsed: string;
  let escalated = false;
  try {
    const out = await extractClinicDetails({ domain, pages, hints });
    extracted = out.data;
    modelUsed = out.model;
  } catch {
    const out = await extractClinicDetails({ domain, pages, hints, model: ESCALATION_MODEL });
    extracted = out.data;
    modelUsed = out.model;
    escalated = true;
  }
  let aiLocs = extracted.locations.map(aiToLoc);
  if (!escalated && aiLocs.length === 0 && g99Locs.length > 0) {
    const out = await extractClinicDetails({ domain, pages, hints, model: ESCALATION_MODEL });
    extracted = out.data;
    modelUsed = out.model;
    escalated = true;
    aiLocs = extracted.locations.map(aiToLoc);
  }
  base.aiLocations = aiLocs.length;

  // 6) merge AI + G99 locations (union; dedupe; gap-fill from G99)
  const merged: SaveLocation[] = [];
  const byKey = new Map<string, SaveLocation>();
  for (const l of aiLocs) {
    const k = locKey(l) || `ai:${merged.length}`;
    if (!byKey.has(k)) {
      byKey.set(k, l);
      merged.push(l);
    }
  }
  for (const gloc of g99Locs) {
    const k = locKey(gloc);
    const hit = k ? byKey.get(k) : undefined;
    if (hit) {
      hit.address = firstNonEmpty(hit.address, gloc.address);
      hit.phone = firstNonEmpty(hit.phone, gloc.phone);
      hit.city = firstNonEmpty(hit.city, gloc.city);
      hit.state = firstNonEmpty(hit.state, gloc.state);
      hit.zip = firstNonEmpty(hit.zip, gloc.zip);
    } else {
      byKey.set(k || `g99:${merged.length}`, gloc);
      merged.push(gloc);
    }
  }
  if (merged.length === 0) merged.push({});

  // 7) primary location carries business-level fields (clinic row reads locations[0])
  const primary = merged[0];
  primary.address = firstNonEmpty(primary.address, rep?.address);
  primary.city = firstNonEmpty(primary.city, rep?.city, repAddr?.city);
  primary.state = firstNonEmpty(primary.state, normalizeState(rep?.state), repAddr?.state);
  primary.zip = firstNonEmpty(primary.zip, repAddr?.zip);
  primary.phone = firstNonEmpty(primary.phone, extracted.phone, rep?.contact_number);
  primary.email = firstNonEmpty(primary.email, extracted.email);
  primary.about = firstNonEmpty(primary.about, extracted.about, extracted.tagline, rep?.about);
  primary.tagline = firstNonEmpty(extracted.tagline, primary.tagline);
  primary.booking_url = firstNonEmpty(primary.booking_url, extracted.booking_url, rep?.appointment_url);
  primary.instagram_url = firstNonEmpty(extracted.instagram_url, rep?.instagram);
  primary.facebook_url = firstNonEmpty(extracted.facebook_url, rep?.facebook);
  primary.tiktok_url = firstNonEmpty(extracted.tiktok_url, rep?.tiktok);
  primary.youtube_url = firstNonEmpty(extracted.youtube_url);
  primary.x_url = firstNonEmpty(extracted.x_url, rep?.twitter);
  primary.linkedin_url = firstNonEmpty(extracted.linkedin_url);
  primary.yelp_url = firstNonEmpty(extracted.yelp_url, rep?.yelp_url);
  primary.google_my_business = firstNonEmpty(rep?.google_my_business);
  primary.maps_url = firstNonEmpty(primary.maps_url, rep?.google_my_business);

  // 8) geocode each location missing coordinates (Nominatim, rate-limited)
  let geocoded = 0;
  for (const loc of merged) {
    if (loc.lat != null && loc.lng != null) {
      geocoded++;
      continue;
    }
    const q = [loc.address, loc.city, loc.state, loc.zip]
      .map((p) => (p ? String(p).trim() : ""))
      .filter(Boolean)
      .join(", ");
    if (!q || q.length < 5) continue;
    const geo = await geocodeAddress(q);
    if (geo) {
      loc.lat = geo.lat;
      loc.lng = geo.lng;
      geocoded++;
    }
  }

  // 9) persist (no services / reviews this phase)
  const bundle: ClinicBundle = {
    website: finalUrl,
    business: {
      name:
        firstNonEmpty(extracted.business_name, prodBiz?.name, row?.business_name, rep?.name, domain) ??
        domain,
    },
    locations: merged,
    services: [],
    reviews: [],
    images,
    google_place_id: rep?.google_place_id ?? null,
    g99_clinic_id: rep?.clinic_id ?? row?.g99_clinic_ids?.[0] ?? null,
    g99_business_id: row?.g99_business_ids?.[0] ?? rep?.tenant_id ?? null,
    g99_tenant_id: row?.g99_business_ids?.[0] ?? rep?.tenant_id ?? null,
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
