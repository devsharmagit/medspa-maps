/**
 * ingest/discover.ts — WordPress/sitemap-aware page discovery.
 *
 * Given a site's homepage, find the most useful extra pages to feed the AI
 * extractor: a LOCATIONS page (multi-location addresses), a CONTACT page, and an
 * ABOUT page. Tries sitemap.xml / wp-sitemap.xml / sitemap_index.xml and the
 * WordPress REST API (/wp-json/wp/v2/pages), then falls back to the heuristic
 * nav-link discovery + URL guesses already in the scraper.
 */

import type { CheerioAPI } from "cheerio";
import { fetchHtml, getBase } from "@/lib/scraper/utils";
import { discoverPages, pageGuesses } from "@/lib/scraper/pages";

const LOC_RE = /\/(locations?|our-locations|find-us|visit-us)(\/|$|\?)/i;
const CONTACT_RE = /\/(contact|contact-us|get-in-touch)(\/|$|\?)/i;
const ABOUT_RE = /\/(about|about-us|our-story|who-we-are)(\/|$|\?)/i;
const TEAM_RE = /\/(our-team|meet-the-team|meet-our-team|the-team|team|our-providers|providers|our-staff|staff|practitioners|injectors)(\/|$|\?)/i;
const SERVICES_RE = /\/(services?|treatments?|menu|procedures|what-we-offer|our-services|med-?spa-services)(\/|$|\?)/i;

function sitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
}

/** Collect page URLs from the site's sitemap(s), following one index level. */
async function collectSitemapUrls(origin: string): Promise<string[]> {
  const out: string[] = [];
  for (const path of ["/sitemap.xml", "/wp-sitemap.xml", "/sitemap_index.xml"]) {
    const r = await fetchHtml(origin + path);
    if (!r) continue;
    const locs = sitemapLocs(r.html);
    const subs = locs.filter((u) => /\.xml($|\?)/i.test(u)).slice(0, 4);
    if (subs.length) {
      for (const sub of subs) {
        const sr = await fetchHtml(sub);
        if (sr) out.push(...sitemapLocs(sr.html));
        if (out.length > 400) break;
      }
    } else {
      out.push(...locs);
    }
    if (out.length) break; // first sitemap that yields URLs wins
  }
  return out;
}

/** WordPress REST: list published pages (the "figure out WordPress" path). */
async function wpJsonPages(origin: string): Promise<string[]> {
  try {
    const res = await fetch(`${origin}/wp-json/wp/v2/pages?per_page=100&_fields=link`, {
      signal: AbortSignal.timeout(12_000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((p) => (p && typeof p === "object" ? (p as { link?: unknown }).link : null))
      .filter((l): l is string => typeof l === "string");
  } catch {
    return [];
  }
}

/**
 * Return up to 4 extra content-page URLs (locations, contact, about, team) to
 * fetch. Excludes the homepage; all same-registrable-host.
 */
export async function discoverContentPages(
  $home: CheerioAPI,
  homeUrl: string
): Promise<string[]> {
  const origin = getBase(homeUrl);
  const host = (u: string): string => {
    try {
      return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return "";
    }
  };
  const homeHost = host(homeUrl);
  const path = (u: string): string => {
    try {
      return new URL(u).pathname.replace(/\/+$/, "").toLowerCase();
    } catch {
      return "";
    }
  };
  const homePath = path(homeUrl);

  const candidates = new Set<string>();
  const nav = discoverPages($home, homeUrl);
  for (const u of [nav.contact, nav.about, nav.team, nav.services]) if (u) candidates.add(u);
  for (const u of pageGuesses(homeUrl, "contact")) candidates.add(u);
  for (const u of pageGuesses(homeUrl, "team")) candidates.add(u);
  for (const u of pageGuesses(homeUrl, "services")) candidates.add(u);
  candidates.add(`${origin}/locations`);
  candidates.add(`${origin}/our-locations`);

  const [smUrls, wpUrls] = await Promise.all([
    collectSitemapUrls(origin),
    wpJsonPages(origin),
  ]);
  for (const u of [...smUrls, ...wpUrls]) candidates.add(u);

  const all = [...candidates].filter((u) => host(u) === homeHost);
  const pick = (re: RegExp): string | undefined => all.find((u) => re.test(path(u) + "/"));

  const chosen: string[] = [];
  const seen = new Set<string>();
  for (const u of [pick(LOC_RE), pick(CONTACT_RE), pick(ABOUT_RE), pick(TEAM_RE), pick(SERVICES_RE)]) {
    if (!u) continue;
    const p = path(u);
    if (!p || p === homePath || seen.has(p)) continue;
    seen.add(p);
    chosen.push(u);
  }
  return chosen.slice(0, 5);
}
