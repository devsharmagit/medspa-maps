/**
 * MedSpaMaps website scraper.
 *
 * Scrapes an HTML medspa website and returns structured JSON covering:
 *   - Contact info (phone, email, address, hours, socials, booking URL)
 *   - Services / treatments
 *   - Team members / providers
 *   - Images (logo, cover, gallery)
 *   - Locations (one per physical site — multi-location aware)
 *
 * Usage:
 *   const result = await scrapeWebsite("https://example-medspa.com");
 *
 * The scraper fetches the homepage + up to 3 sub-pages (services, team, contact).
 * All network calls are parallelized for speed.
 */

import type { ScrapeResult, ScrapeContact } from "./types";
import { fetchHtml, getBase, normalizeUrl, load } from "./utils";
import { discoverPages, pageGuesses } from "./pages";
import { extractContact } from "./contact";
import { extractServices, extractServicesFromNav } from "./services";
import { extractProviders } from "./providers";
import { extractImages, extractCover } from "./images";
import { detectLocations } from "./locations";

export type {
  ScrapeResult,
  ScrapeContact,
  ScrapedService,
  ScrapedProvider,
  ScrapedImage,
  ScrapedLocation,
  HoursEntry,
} from "./types";

/** Scrape a medspa website and return structured data */
export async function scrapeWebsite(rawUrl: string): Promise<ScrapeResult> {
  const url = normalizeUrl(rawUrl);
  const baseUrl = getBase(url);
  const pagesVisited: string[] = [];
  const scraped_at = new Date().toISOString();

  // ── Fetch homepage ──────────────────────────────────────────────────────────
  const homeResult = await fetchHtml(url);
  if (!homeResult) {
    return {
      url,
      scraped_at,
      pages_visited: [],
      contact: {},
      locations: [],
      services: [],
      providers: [],
      images: [],
    };
  }

  const { html: homeHtml, finalUrl } = homeResult;
  const effectiveBase = getBase(finalUrl) || baseUrl;
  pagesVisited.push(finalUrl);

  const $home = load(homeHtml);

  // ── Discover sub-pages from homepage nav ────────────────────────────────────
  const discovered = discoverPages($home, effectiveBase);

  // Resolve pages (discovered or guessed)
  const servicesUrl = discovered.services ?? null;
  const teamUrl = discovered.team ?? null;
  const contactUrl = discovered.contact ?? null;
  const aboutUrl = discovered.about ?? null;

  // ── Fetch sub-pages in parallel ─────────────────────────────────────────────
  const [servicesResult, teamResult, contactResult, aboutResult] = await Promise.all([
    servicesUrl ? fetchHtml(servicesUrl) : tryGuessedPages(effectiveBase, "services"),
    teamUrl ? fetchHtml(teamUrl) : tryGuessedPages(effectiveBase, "team"),
    contactUrl ? fetchHtml(contactUrl) : tryGuessedPages(effectiveBase, "contact"),
    aboutUrl ? fetchHtml(aboutUrl) : null,
  ]);

  if (servicesResult) pagesVisited.push(servicesResult.finalUrl);
  if (teamResult) pagesVisited.push(teamResult.finalUrl);
  if (contactResult) pagesVisited.push(contactResult.finalUrl);
  if (aboutResult) pagesVisited.push(aboutResult.finalUrl);

  // ── Extract contact (merge across homepage + contact + about) ───────────────
  const homeContact = extractContact($home, homeHtml);
  let merged: ScrapeContact = homeContact;

  let $contactPage: ReturnType<typeof load> | undefined;
  let contactPageHtml: string | undefined;

  if (contactResult) {
    $contactPage = load(contactResult.html);
    contactPageHtml = contactResult.html;
    const c = extractContact($contactPage, contactResult.html);
    merged = mergeContact(merged, c);
  }
  if (aboutResult) {
    const $about = load(aboutResult.html);
    const c = extractContact($about, aboutResult.html);
    merged = mergeContact(merged, c);
  }

  // ── Detect locations (multi-location aware) ──────────────────────────────────
  // Pass the contact page DOM so the footer text parser can use it (highest priority source)
  const locations = await detectLocations(
    $home, homeHtml, effectiveBase, merged,
    $contactPage, contactPageHtml,
  );

  // ── Extract services ─────────────────────────────────────────────────────────
  const allServices: ReturnType<typeof extractServices> = [];

  // Primary: nav-link extraction (Step 2 of spec).
  // The homepage nav always contains the full treatment catalogue with proper URLs.
  const navServices = extractServicesFromNav($home, effectiveBase);
  allServices.push(...navServices);

  // Secondary: services page content — only runs when nav extraction found nothing.
  // Content extraction is noisier (headings, list items) and adds false positives
  // when mixed with clean nav URLs, so it's reserved as a fallback only.
  if (navServices.length === 0 && servicesResult) {
    const $svc = load(servicesResult.html);
    const pageServices = extractServices($svc, servicesResult.finalUrl);
    const existingSlugs = new Set(allServices.map((s) => s.slug));
    allServices.push(...pageServices.filter((s) => !existingSlugs.has(s.slug)));
  }

  // Final fallback: DOM card / heading extraction on homepage.
  if (allServices.length === 0) {
    allServices.push(...extractServices($home, finalUrl));
  }

  // ── Extract providers ─────────────────────────────────────────────────────────
  const allProviders: ReturnType<typeof extractProviders> = [];

  if (teamResult) {
    const $team = load(teamResult.html);
    allProviders.push(...extractProviders($team, teamResult.finalUrl));
  }

  // Also try homepage (some single-page sites have team section there)
  if (allProviders.length === 0) {
    allProviders.push(...extractProviders($home, finalUrl));
  }

  // ── Extract images ────────────────────────────────────────────────────────────
  // Pass business name + city so cover selection is scored by relevance (Step 3 of spec).
  const homeImages = extractImages($home, effectiveBase, merged.name, merged.city);

  // Add cover from services page if homepage had none
  const hasCover = homeImages.some((i) => i.role === "cover");
  if (!hasCover && servicesResult) {
    const $svc = load(servicesResult.html);
    const cover = extractCover($svc, servicesResult.finalUrl, merged.name, merged.city);
    if (cover) homeImages.unshift(cover);
  }

  return {
    url: finalUrl,
    scraped_at,
    pages_visited: pagesVisited,
    contact: merged,
    locations,
    services: allServices,
    providers: allProviders,
    images: homeImages,
  };
}

/** Try a list of guessed page URLs, return the first that responds */
async function tryGuessedPages(
  baseUrl: string,
  type: "services" | "team" | "contact"
): Promise<{ html: string; finalUrl: string } | null> {
  const guesses = pageGuesses(baseUrl, type);
  for (const guess of guesses) {
    const result = await fetchHtml(guess);
    if (result) return result;
  }
  return null;
}

/** Merge two ScrapeContact objects — existing value wins over undefined */
function mergeContact(base: ScrapeContact, incoming: ScrapeContact): ScrapeContact {
  const result: ScrapeContact = { ...base };
  for (const [k, v] of Object.entries(incoming) as [keyof ScrapeContact, unknown][]) {
    if (v !== undefined && v !== null && result[k] === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[k] = v;
    }
  }
  return result;
}
