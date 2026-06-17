/**
 * POST /api/scrape
 * GET  /api/scrape?url=https://example-medspa.com
 *
 * Scrapes a WordPress-style medspa website and returns a structured JSON
 * payload that is ready to be inserted into the MedSpaMaps database.
 *
 * Response shape:
 * {
 *   "scraped_at": "ISO timestamp",
 *   "source_url": "https://...",
 *   "pages_visited": [...],
 *   "business": {
 *     ...businesses row fields,
 *     "logo_url": "https://...",        ← logo for the business
 *     "business_images": [...]          ← logo image rows for images table
 *   },
 *   "clinics": [
 *     {
 *       ...clinics row fields,          ← address/city/state/zip/lat/lng differ per location
 *       "services": [...],              ← same services for all locations
 *       "images":   [...]               ← cover + gallery rows for images table
 *     }
 *   ]
 * }
 *
 * Multi-location: if a site has 2 locations → clinics array has 2 entries,
 * each with different address/city/state/zip/lat/lng but same services/images/socials.
 *
 * Rate limiting: max 1 request per URL per 60 seconds (in-memory).
 */

import { NextRequest, NextResponse } from "next/server";
import { scrapeWebsite } from "@/lib/scraper";
import type { ScrapeResult, ScrapedLocation, ScrapeContact } from "@/lib/scraper";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface BusinessRow {
  name: string;
  tier: "free";
  verified: false;
  data_source: "scraped";
  is_active: true;
  /** Convenience: logo URL so you don't need to dig into business_images */
  logo_url?: string;
  /** Logo image rows for the images table (entity_type = 'business') */
  business_images: ImageRow[];
}

interface ClinicServiceRow {
  raw_name: string;
  slug: string;
  category?: string;
  is_category?: boolean;
  description?: string;
  price_from?: number;
  price_to?: number;
  price_notes?: string;
  price_varies?: boolean;
  duration_minutes?: number;
  data_source: "scraped";
  scraped_from_url: string;
}

interface ImageRow {
  entity_type: "clinic" | "business";
  source_url: string;
  role: "cover" | "gallery" | "logo";
  alt_text?: string;
  sort_order: number;
  match_score?: number;
  scraped_domain: string;
  scrape_status: "pending";
}

interface ClinicRow {
  name: string;
  slug: string;
  website: string;
  booking_url: string | null;
  // ── Location-specific (differs per clinic in multi-location) ─────────────────
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  country: "US";
  phone: string | null;
  email: string | null;
  // ── Shared across all locations ───────────────────────────────────────────────
  about: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
  linkedin_url: string | null;
  x_url: string | null;
  yelp_url: string | null;
  google_my_business: string | null;
  google_maps_url: string | null;
  hours: Record<string, { open: string | null; close: string | null; is_open: boolean }> | null;
  tier: "free";
  verified: false;
  featured: false;
  data_source: "scraped";
  last_scraped_at: string;
  is_active: true;
  /** clinic_services rows */
  services: ClinicServiceRow[];
  /** images rows (entity_type = 'clinic') — cover + gallery */
  images: ImageRow[];
  /** Convenience: direct URL to the cover image */
  cover_image_url: string | null;
}

interface ScrapeApiResponse {
  scraped_at: string;
  source_url: string;
  pages_visited: string[];
  business: BusinessRow;
  clinics: ClinicRow[];
}

// ─── Simple in-memory rate limiter ────────────────────────────────────────────

const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 60_000;

function isRateLimited(url: string): boolean {
  const last = rateLimitMap.get(url);
  if (!last) return false;
  return Date.now() - last < RATE_LIMIT_MS;
}

function markAccessed(url: string) {
  rateLimitMap.set(url, Date.now());
  if (rateLimitMap.size > 100) {
    const cutoff = Date.now() - RATE_LIMIT_MS * 2;
    for (const [k, v] of rateLimitMap) {
      if (v < cutoff) rateLimitMap.delete(k);
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(val: string): string {
  return val
    .toLowerCase()
    .replace(/[®™©°]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/, "");
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Generate a Google Maps URL for a clinic location.
 * Uses lat/lng when available (most accurate pin), otherwise falls back to address search.
 */
function buildMapsUrl(
  lat: number | null,
  lng: number | null,
  address: string | null,
): string | null {
  if (lat !== null && lng !== null) {
    // Precise coordinates — encode address as the search label, fall back to bare coords
    const q = address ? encodeURIComponent(address) : `${lat},${lng}`;
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
  return null;
}

/**
 * Build a ClinicRow from a location + shared contact/scrape data.
 *
 * For multi-location sites, each clinic gets:
 *   - Its own address/city/state/zip/lat/lng from the location entry
 *   - Shared services, images, socials, about from the merged contact
 */
function buildClinic(
  location: ScrapedLocation,
  contact: ScrapeContact,
  result: ScrapeResult,
  businessName: string,
  isMultiLocation: boolean,
  sourceUrl: string
): ClinicRow {
  const city = location.city ?? contact.city;
  const clinicName = isMultiLocation && city
    ? `${businessName} – ${city}`
    : businessName;

  const slug = slugify(clinicName);
  const domain = getDomain(sourceUrl);

  // Services → clinic_services rows (shared across all locations)
  const services: ClinicServiceRow[] = result.services.map((svc) => ({
    raw_name: svc.name,
    slug: svc.slug,
    category: svc.category,
    is_category: svc.is_category,
    description: svc.description,
    price_from: svc.price_from,
    price_to: svc.price_to,
    price_notes: svc.price_notes,
    price_varies: svc.price_varies,
    duration_minutes: svc.duration_minutes,
    data_source: "scraped",
    // Use the actual service page URL captured during nav scraping; fall back to site root.
    scraped_from_url: svc.scraped_from_url ?? sourceUrl,
  }));

  // Images → images rows for the clinic (cover + gallery only — logo goes on business)
  const clinicImages = result.images.filter((img) => img.role !== "logo");
  const logoUrl = result.images.find((img) => img.role === "logo")?.source_url;

  // Re-score images by this clinic's city for per-location cover selection (Step 3).
  const clinicCityLower = (location.city ?? contact.city ?? "").toLowerCase();
  const clinicCityTokens = clinicCityLower.split(/\s+/).filter((t) => t.length > 2);

  function cityCoverScore(img: { source_url: string; alt_text?: string; match_score?: number }): number {
    const altLow = (img.alt_text ?? "").toLowerCase();
    const filename = (img.source_url.split("/").pop() ?? "")
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]/g, " ")
      .toLowerCase();
    let score = img.match_score ?? 0;
    for (const token of clinicCityTokens) {
      if (altLow.includes(token) || filename.includes(token)) score += 3;
    }
    return score;
  }

  const images: ImageRow[] = clinicImages.map((img, i) => ({
    entity_type: "clinic" as const,
    source_url: img.source_url,
    role: img.role,
    alt_text: img.alt_text,
    sort_order: img.sort_order ?? i,
    match_score: img.match_score,
    scraped_domain: domain,
    scrape_status: "pending" as const,
  }));

  // Select cover: non-logo image with highest per-city score.
  const coverImage = clinicImages
    .filter(
      (img) =>
        img.source_url !== logoUrl &&
        !/\blogo\b/i.test(img.alt_text ?? "") &&
        img.role !== "logo",
    )
    .sort((a, b) => cityCoverScore(b) - cityCoverScore(a))[0];

  return {
    name: clinicName,
    slug,
    website: sourceUrl,
    booking_url: contact.booking_url ?? null,
    // ── Location-specific ───────────────────────────────────────────────────
    address: location.address ?? contact.address ?? null,
    city: city ?? null,
    state: location.state ?? contact.state ?? null,
    zip: location.zip ?? contact.zip ?? null,
    lat: location.lat ?? contact.lat ?? null,
    lng: location.lng ?? contact.lng ?? null,
    country: "US",
    phone: location.phone ?? contact.phone ?? null,
    email: location.email ?? contact.email ?? null,
    // ── Shared ───────────────────────────────────────────────────────────────
    about: contact.about ?? null,
    instagram_url: contact.instagram_url ?? null,
    facebook_url: contact.facebook_url ?? null,
    tiktok_url: contact.tiktok_url ?? null,
    youtube_url: contact.youtube_url ?? null,
    linkedin_url: contact.linkedin_url ?? null,
    x_url: contact.x_url ?? null,
    yelp_url: contact.yelp_url ?? null,
    google_my_business: contact.google_my_business ?? null,
    google_maps_url: location.maps_url
      ?? buildMapsUrl(
        location.lat ?? contact.lat ?? null,
        location.lng ?? contact.lng ?? null,
        location.address ?? contact.address ?? null,
      ),
    hours: location.hours ?? contact.hours ?? null,
    tier: "free",
    verified: false,
    featured: false,
    data_source: "scraped",
    last_scraped_at: result.scraped_at,
    is_active: true,
    services,
    images,
    cover_image_url: coverImage?.source_url ?? null,
  };
}

// ─── Shape the full DB-ready payload ─────────────────────────────────────────

function shapeScrapeResult(result: ScrapeResult): ScrapeApiResponse {
  const { contact, locations, images, url, scraped_at, pages_visited } = result;

  const businessName =
    contact.name ??
    getDomain(url)
      .split(".")
      .slice(0, -1)
      .join(" ")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const domain = getDomain(url);

  // Business-level logo
  const logoImage = images.find((img) => img.role === "logo");
  const businessImages: ImageRow[] = logoImage
    ? [
        {
          entity_type: "business",
          source_url: logoImage.source_url,
          role: "logo",
          alt_text: logoImage.alt_text,
          sort_order: 0,
          scraped_domain: domain,
          scrape_status: "pending",
        },
      ]
    : [];

  const business: BusinessRow = {
    name: businessName,
    tier: "free",
    verified: false,
    data_source: "scraped",
    is_active: true,
    logo_url: logoImage?.source_url,
    business_images: businessImages,
  };

  const isMultiLocation = locations.length > 1;

  const clinics: ClinicRow[] = locations.map((loc) =>
    buildClinic(loc, contact, result, businessName, isMultiLocation, url)
  );

  return {
    scraped_at,
    source_url: url,
    pages_visited,
    business,
    clinics,
  };
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawUrl = searchParams.get("url")?.trim();

  if (!rawUrl) {
    return NextResponse.json(
      {
        error: "Missing required query parameter: url",
        example: "/api/scrape?url=https://example-medspa.com",
      },
      { status: 400 }
    );
  }

  let targetUrl: string;
  try {
    const u = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
    targetUrl = u.href;
  } catch {
    return NextResponse.json({ error: "Invalid URL provided" }, { status: 400 });
  }

  if (isRateLimited(targetUrl)) {
    return NextResponse.json(
      { error: "Rate limited — please wait 60 seconds before re-scraping the same URL" },
      { status: 429 }
    );
  }

  markAccessed(targetUrl);

  try {
    console.log(`[scrape] Scraping: ${targetUrl}`);
    const result = await scrapeWebsite(targetUrl);
    const payload = shapeScrapeResult(result);

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
        "X-Scraped-At": payload.scraped_at,
        "X-Pages-Visited": String(payload.pages_visited.length),
        "X-Locations-Found": String(payload.clinics.length),
      },
    });
  } catch (err) {
    console.error("[scrape] Error:", err);
    return NextResponse.json(
      { error: "Scrape failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  let body: { url?: string; urls?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Batch mode: POST { urls: [...] }
  if (Array.isArray(body.urls)) {
    if (body.urls.length > 10) {
      return NextResponse.json({ error: "Batch limit is 10 URLs per request" }, { status: 400 });
    }

    const results = await Promise.allSettled(
      body.urls.map(async (rawUrl) => {
        const u = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
        const result = await scrapeWebsite(u.href);
        return shapeScrapeResult(result);
      })
    );

    return NextResponse.json({
      results: results.map((r, i) =>
        r.status === "fulfilled"
          ? { url: body.urls![i], ok: true, data: r.value }
          : { url: body.urls![i], ok: false, error: (r.reason as Error)?.message ?? "unknown" }
      ),
    });
  }

  // Single mode: POST { url: "..." }
  if (!body.url) {
    return NextResponse.json(
      { error: "Body must contain `url` (string) or `urls` (array)" },
      { status: 400 }
    );
  }

  let targetUrl: string;
  try {
    const u = new URL(body.url.startsWith("http") ? body.url : `https://${body.url}`);
    targetUrl = u.href;
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (isRateLimited(targetUrl)) {
    return NextResponse.json(
      { error: "Rate limited — wait 60 seconds before re-scraping" },
      { status: 429 }
    );
  }

  markAccessed(targetUrl);

  try {
    const result = await scrapeWebsite(targetUrl);
    const payload = shapeScrapeResult(result);
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
        "X-Scraped-At": payload.scraped_at,
        "X-Locations-Found": String(payload.clinics.length),
      },
    });
  } catch (err) {
    console.error("[scrape] Error:", err);
    return NextResponse.json(
      { error: "Scrape failed", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
