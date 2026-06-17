import type { ScrapeApiResponse } from "../types";

const BASE = (process.env.NEXTJS_URL ?? "http://localhost:3000").replace(/\/$/, "");
const SECRET = process.env.INTERNAL_API_SECRET ?? "";
const TIMEOUT_MS = 45_000;

// G99 portal / booking / social domains — not real medspa websites
const SKIP_DOMAINS = new Set([
  "growthemr.com",
  "devemr.growthemr.com",
  "portal.growthemr.com",
  "dev-app.growthemr.com",
  "gogroth.com",
  "growth99.com",
  "google.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "yelp.com",
  "typeform.com",
  "atlassian.net",
  "basecamp.com",
  "yahoo.com",
  "chat.openai.com",
]);

export function isScrapableUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./, "");
    if (SKIP_DOMAINS.has(host)) return false;
    for (const skip of SKIP_DOMAINS) {
      if (host.endsWith(`.${skip}`)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function scrapeWebsite(url: string): Promise<ScrapeApiResponse | null> {
  try {
    const target = url.startsWith("http") ? url : `https://${url}`;
    const res = await fetch(
      `${BASE}/api/scrape?url=${encodeURIComponent(target)}`,
      {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "x-internal-secret": SECRET },
      }
    );
    if (!res.ok) {
      console.warn(`[scraper] HTTP ${res.status} for ${url}`);
      return null;
    }
    return (await res.json()) as ScrapeApiResponse;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[scraper] Failed for ${url}: ${msg}`);
    return null;
  }
}
