/**
 * rescrape/detect.ts — detect a clinic's current treatments from its live site.
 *
 * This is the treatment-detection subset of the add-a-clinic pipeline
 * (scrape-preview.ts), reusing the EXACT same building blocks so the daily
 * re-scrape and the initial add can never disagree about what a site offers:
 *
 *   scrapeWebsite() → buildServices() → matchService() / isLikelyNoise()
 *
 * It intentionally skips the add-clinic extras (images, reviews, before/after,
 * Google-Maps location resolution) — the cron only cares about treatments.
 */

import { scrapeWebsite } from "@/lib/scraper";
import { normalizeUrl } from "@/lib/scraper/utils";
import { buildServices } from "@/lib/admin/scrape-preview";
import { matchService, isLikelyNoise } from "@/lib/taxonomy/canonical";

export interface DetectedService {
  raw_name: string;
  description: string | null;
  scraped_from_url: string | null;
  /** canonical service slug this raw name maps to, or null if unmatched */
  slug: string | null;
  confidence: number;
  is_noise: boolean;
}

export interface DetectionResult {
  /** the normalized URL that was actually scraped */
  scrapedUrl: string;
  /** every raw service found (matched, unmatched, and noise) */
  services: DetectedService[];
  /** number of pages the scraper successfully fetched */
  pagesVisited: number;
  /** distinct canonical slugs the clinic currently offers (matched, non-noise) */
  matchedSlugs: string[];
}

/**
 * detectClinicServices(url) — scrape a live site and return its detected
 * services plus the deduped set of canonical treatment slugs it offers.
 *
 * Mirrors scrapeClinicPreview()'s service block exactly (same matchService +
 * isLikelyNoise + matched-slug filter) so results are identical to add-clinic.
 */
export async function detectClinicServices(url: string): Promise<DetectionResult> {
  const siteUrl = normalizeUrl(url);
  const scrape = await scrapeWebsite(siteUrl);

  const rawServices = await buildServices(siteUrl, scrape.services);
  const services: DetectedService[] = rawServices.map((s) => {
    const raw = s.name.trim();
    const m = matchService(raw);
    return {
      raw_name: raw,
      description: s.description ?? null,
      scraped_from_url: s.scraped_from_url ?? null,
      slug: m.slug,
      confidence: m.confidence,
      is_noise: isLikelyNoise(raw),
    };
  });

  // Same rule as scrape-preview: only non-noise services that resolve to one of
  // the 15 canonical treatments count toward the offered set.
  const matchedSlugs = Array.from(
    new Set(
      services
        .filter((s) => !s.is_noise && s.slug)
        .map((s) => s.slug as string)
    )
  );

  return {
    scrapedUrl: scrape.url,
    services,
    pagesVisited: scrape.pages_visited.length,
    matchedSlugs,
  };
}
