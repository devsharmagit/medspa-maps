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
// Before-&-after / results galleries. "gallery"/"results" are generic but are
// exactly where B&A photos live; the per-image filename heuristic + AI fallback
// keep precision downstream.
const BEFOREAFTER_RE = /\/(before-?and-?after[a-z-]*|before-?after[a-z-]*|beforeafter[a-z-]*|results|patient-results|transformations|(photo|patient|treatment|aesthetic-treatment)-gallery|gallery)(\/|$|\?)/i;

function sitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
}

interface SitemapEntry {
  url: string;
  /** URL came from a blog-post sub-sitemap (WordPress post-sitemap.xml etc.) —
   *  the CMS's own page-vs-post classification, used to keep blog articles out
   *  of concern-evidence discovery. */
  isPost: boolean;
}

const POST_SITEMAP_RE = /(post|posts|news|blog|article)s?[-_]?sitemap[^/]*\.xml($|\?)/i;

/** Collect page URLs from the site's sitemap(s), following one index level and
 *  remembering which sub-sitemap (page vs post) each URL came from. */
async function collectSitemapEntries(origin: string): Promise<SitemapEntry[]> {
  const out: SitemapEntry[] = [];
  for (const path of ["/sitemap.xml", "/wp-sitemap.xml", "/sitemap_index.xml"]) {
    const r = await fetchHtml(origin + path);
    if (!r) continue;
    const locs = sitemapLocs(r.html);
    const subs = locs.filter((u) => /\.xml($|\?)/i.test(u)).slice(0, 4);
    if (subs.length) {
      for (const sub of subs) {
        const sr = await fetchHtml(sub);
        if (sr) {
          const isPost = POST_SITEMAP_RE.test(sub);
          out.push(...sitemapLocs(sr.html).map((url) => ({ url, isPost })));
        }
        if (out.length > 400) break;
      }
    } else {
      out.push(...locs.map((url) => ({ url, isPost: false })));
    }
    if (out.length) break; // first sitemap that yields URLs wins
  }
  return out;
}

async function collectSitemapUrls(origin: string): Promise<string[]> {
  return (await collectSitemapEntries(origin)).map((e) => e.url);
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
  // NOTE: no before/after URL *guesses* — real B&A pages use many different
  // paths (/before-and-after-treatment-images/, /aesthetic-treatment-gallery/,
  // …) and a short guess like /before-and-after would 404 yet still win pick()
  // over the real page (guesses are ordered before sitemap URLs). Rely on the
  // sitemap / nav / WP-REST candidates, which carry the true URL.

  const [smUrls, wpUrls] = await Promise.all([
    collectSitemapUrls(origin),
    wpJsonPages(origin),
  ]);
  for (const u of [...smUrls, ...wpUrls]) candidates.add(u);

  const all = [...candidates].filter((u) => host(u) === homeHost);
  const pick = (re: RegExp): string | undefined => all.find((u) => re.test(path(u) + "/"));

  const chosen: string[] = [];
  const seen = new Set<string>();
  for (const u of [pick(LOC_RE), pick(CONTACT_RE), pick(ABOUT_RE), pick(TEAM_RE), pick(SERVICES_RE), pick(BEFOREAFTER_RE)]) {
    if (!u) continue;
    const p = path(u);
    if (!p || p === homePath || seen.has(p)) continue;
    seen.add(p);
    chosen.push(u);
  }
  return chosen.slice(0, 6);
}

// ── Concern-page discovery (concerns ingest only) ────────────────────────────

// Pages whose PATH names a patient condition or a "what we treat" hub. Built
// from the concern survey (medimorph /acne/, /acne-scarring/, /self-assessment/)
// plus the canonical-concern vocabulary. Condition-named pages are the highest-
// confidence concern evidence there is.
const CONCERN_HUB_RE =
  /\/(concerns?|conditions?|skin-concerns?|what-we-treat|we-treat|i-want-to-treat|self-assessments?)(\/|$|\?)/i;
const CONCERN_WORD_RE =
  /\/((?:[a-z0-9]+-)*(?:acne|scarr?ing|scars?|rosacea|melasma|hyperpigmentation|pigmentation|dark-spots?|sun-damage|wrinkles?|fine-lines?|sagging|laxity|loose-skin|double-chin|cellulite|stretch-marks?|hair-loss|hair-thinning|hyperhidrosis|sweating|dark-circles?|dull-skin|dry-skin|oily-skin|large-pores?|enlarged-pores?|volume-loss|thin-lips?|jowls)(?:-[a-z0-9]+)*)(\/|$|\?)/i;
// Per-treatment detail pages ("addresses concerns like…" prose lives here). The
// hub SERVICES_RE page is already covered by discoverContentPages; this matches
// nested/leaf paths too.
const SERVICE_DETAIL_RE =
  /\/(services?|treatments?|procedures|injectables?|injections?|facials?|laser[a-z-]*|body[a-z-]*|skin[a-z-]*|aesthetics?)(\/|$|\?)|\/(botox|dysport|fillers?|microneedling|morpheus[a-z0-9-]*|ultherapy|sofwave|kybella|coolsculpting|prp|pdo[a-z-]*|chemical-peels?|ipl|photofacial|hydrafacial|emsculpt[a-z-]*|laser-hair-removal|weight-loss|hormone[a-z-]*|iv-therapy)(\/|$|\?)/i;
// Location-SEO pages ("/medical-spa-near-<city>/", "…-scar-near-orem-ut"),
// blog archives, and shop pages are noise for concern evidence.
const CONCERN_NOISE_RE =
  /\/(blog|news|category|tag|author|product[a-z-]*|shop|cart|checkout)(\/|-|$)|-near-/i;
// Blog-ARTICLE slugs for sites that serve posts at the root (no /blog/ prefix):
// question/how-to/listicle patterns and very long editorial slugs. Policy:
// concern evidence may come ONLY from the homepage, condition pages, or
// treatment pages — never blog posts (definitional articles read like the
// clinic treats everything they explain).
const BLOG_SLUG_RE =
  /\/(how|why|what|when|where|which|who|is|are|can|does|do|should|top|best|everything)-[^/]*$|-(tips|guide|myths|facts|trends)(-|\/|$)|-vs-/i;
const BLOG_SLUG_MAX_WORDS = 7;

function looksLikeBlogSlug(p: string): boolean {
  if (BLOG_SLUG_RE.test(p)) return true;
  const last = p.split("/").filter(Boolean).pop() ?? "";
  return last.split("-").filter(Boolean).length >= BLOG_SLUG_MAX_WORDS;
}

export interface ConcernPageBudget {
  concernPages?: number;
  servicePages?: number;
}

/**
 * Pages for the CONCERNS extraction: condition-named pages first (take ALL
 * matches up to the cap, not first-match), then per-treatment service pages.
 * `extraServiceUrls` lets the caller add nav-scraped treatment hrefs (often not
 * in sitemap picks). Excludes the homepage (the caller sends it separately).
 *
 * EVIDENCE-SOURCE POLICY: only the homepage, condition pages, and treatment
 * pages qualify — blog posts are excluded (CMS post-sitemap classification +
 * slug-shape heuristic), because editorial articles explain conditions the
 * clinic doesn't necessarily treat.
 */
export async function discoverConcernPages(
  $home: CheerioAPI,
  homeUrl: string,
  extraServiceUrls: string[] = [],
  budget: ConcernPageBudget = {}
): Promise<{ concernPages: string[]; servicePages: string[] }> {
  // Generous defaults: with blog posts excluded and no per-clinic concern cap,
  // the page budget shouldn't be what silently drops a treated condition.
  const maxConcern = budget.concernPages ?? 6;
  const maxService = budget.servicePages ?? 12;
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
  if (nav.services) candidates.add(nav.services);
  // NOTE: no URL guesses — dead guesses (e.g. /treatments 404) would eat the
  // fetch budget. Sitemap / WP-REST / nav / passed-in hrefs carry real URLs.
  const [smEntries, wpUrls] = await Promise.all([
    collectSitemapEntries(origin),
    wpJsonPages(origin), // WP-REST /wp/v2/pages returns PAGES only — never posts
  ]);
  // Blog-post URLs per the CMS's own sitemap classification. Evidence policy:
  // homepage / condition pages / treatment pages ONLY — a post-sitemap URL can
  // never become a concern-evidence source.
  const blogUrls = new Set(smEntries.filter((e) => e.isPost).map((e) => e.url));
  for (const e of smEntries) candidates.add(e.url);
  for (const u of [...wpUrls, ...extraServiceUrls]) candidates.add(u);

  const all = [...candidates].filter((u) => host(u) === homeHost);
  // Dedupe key folds per-city SEO variants ("/acne-scarring-in-tampa-fl" ≡
  // "/acne-scarring-in-melbourne-fl") so one variant is fetched, not three.
  const pathKey = (p: string): string =>
    p.replace(/-in-[a-z]+(-[a-z]+)*-[a-z]{2}$/i, "");
  const seen = new Set<string>([pathKey(homePath)]);
  // Prefer SHORT paths: dedicated pages ("/acne/", "/rf-microneedling/") beat
  // long blog-post slugs ("/skinpen-microneedling-for-acne-scars/") that happen
  // to contain a condition word.
  const depth = (p: string): number => p.split("/").filter(Boolean).length;
  const takeAll = (re: RegExp, cap: number): string[] => {
    const matches: Array<{ u: string; p: string }> = [];
    for (const u of all) {
      const p = path(u);
      if (!p || seen.has(pathKey(p))) continue;
      if (!re.test(p + "/") || CONCERN_NOISE_RE.test(p + "/")) continue;
      // Blog posts are never evidence sources — by sitemap type or by slug shape.
      if (blogUrls.has(u) || looksLikeBlogSlug(p)) continue;
      seen.add(pathKey(p));
      matches.push({ u, p });
    }
    matches.sort((a, b) => depth(a.p) - depth(b.p) || a.p.length - b.p.length);
    for (const m of matches.slice(cap)) seen.delete(pathKey(m.p)); // beyond-cap stays eligible later
    return matches.slice(0, cap).map((m) => m.u);
  };

  const concernPages = [
    ...takeAll(CONCERN_HUB_RE, maxConcern),
    ...takeAll(CONCERN_WORD_RE, maxConcern),
  ].slice(0, maxConcern);
  const servicePages = takeAll(SERVICE_DETAIL_RE, maxService);
  return { concernPages, servicePages };
}
