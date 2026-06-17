import type { CheerioAPI, Cheerio } from "cheerio";
import type { AnyNode } from "domhandler";
import type { ScrapedImage } from "./types";
import { toAbsolute, dedupeBy } from "./utils";

type CheerioEl = Cheerio<AnyNode>;

const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;
const MAX_GALLERY = 10;

// ─── Lazy-load attribute priority list (most common WordPress plugins) ─────────
// Ordered: most-specific first (plugin-specific) → generic fallbacks
const LAZY_SRC_ATTRS = [
  "data-lzl-src",        // LZL / Lazy Load by WP Rocket
  "data-lzl-srcset",     // LZL srcset variant
  "data-src",            // Very Lazy Load, Intersection Observer plugins
  "data-lazy-src",       // Lazy Load XT, WP Lazy Load
  "data-original",       // lazyload.js
  "data-lazy",           // bLazy.js
  "data-delayed-src",    // some WP themes
  "data-echo",           // Echo.js
  "src",                 // Actual src (may be data: if lazy)
];

const LOGO_SELECTORS = [
  "header img[class*='logo']",
  "header img[alt*='logo' i]",
  "img[class*='logo']",
  "img[id*='logo']",
  ".logo img",
  "#logo img",
  "[class*='navbar'] img",
  "[class*='header'] img",
];

const HERO_SELECTORS = [
  "[class*='hero'] img",
  "[class*='banner'] img",
  "[class*='slider'] img",
  "[class*='slide'] img",
  "[class*='carousel'] img",
  "[class*='hero-image'] img",
  "[class*='bg-image'] img",
  "section:first-of-type img",
];

const GALLERY_SELECTORS = [
  "[class*='gallery'] img",
  "[class*='portfolio'] img",
  "[class*='grid'] img",
  "[class*='masonry'] img",
];

// Patterns that indicate the image is not a useful content image
const SKIP_PATTERNS = [
  /placeholder/i,
  /blank/i,
  /spacer/i,
  /pixel/i,
  /tracking/i,
  /data:image\/svg/i,   // SVG placeholders (NOT base64 PNGs — those could be real)
  /favicon/i,
  /arrow/i,
  /sprite/i,
  /loading/i,
  // social media icons (small)
  /\/social[-_]?icon/i,
  /\/(insta|fb|twitter|tiktok|yt)[-_.]?(icon|logo)/i,
];

function shouldSkip(src: string, alt: string): boolean {
  // Always skip data: URIs  
  if (src.startsWith("data:image/svg")) return true;
  if (src.startsWith("data:image/gif")) return true; // 1x1 tracking pixels
  return SKIP_PATTERNS.some((p) => p.test(src) || p.test(alt));
}

/**
 * Get the real image src from an element, trying all known lazy-load attrs
 * in priority order, skipping data: placeholders.
 */
function getRealSrc(el: CheerioEl): string {
  for (const attr of LAZY_SRC_ATTRS) {
    const val = el.attr(attr) ?? "";
    if (!val) continue;
    // Skip data: URI placeholders — they're lazy-load placeholders
    if (val.startsWith("data:image/svg") || val.startsWith("data:image/gif")) continue;
    // If it's a base64 PNG (actual image inline), accept it
    if (val.startsWith("data:image/")) return val;
    // Otherwise take the first URL from srcset if needed
    if (attr.includes("srcset")) {
      const firstUrl = val.split(",")[0].trim().split(/\s+/)[0];
      if (firstUrl && !firstUrl.startsWith("data:")) return firstUrl;
      continue;
    }
    return val;
  }
  return "";
}

function getImgAttrs(el: CheerioEl): { src: string; alt: string; w: number; h: number } {
  const src = getRealSrc(el);
  const alt = el.attr("alt") ?? "";
  const w = parseInt(el.attr("width") ?? "0") || 0;
  const h = parseInt(el.attr("height") ?? "0") || 0;
  return { src, alt, w, h };
}

function isTooSmall(w: number, h: number): boolean {
  if (w > 0 && w < MIN_WIDTH) return true;
  if (h > 0 && h < MIN_HEIGHT) return true;
  return false;
}

// ─── Schema.org logo extraction ────────────────────────────────────────────────

/**
 * Try to extract logo from schema.org JSON-LD Organization/LocalBusiness node.
 * Returns the URL string or null.
 */
function extractSchemaLogo($: CheerioAPI): string | null {
  let logoUrl: string | null = null;

  $("script[type='application/ld+json']").each((_, el) => {
    if (logoUrl) return;
    try {
      const data = JSON.parse($(el).html() ?? "");
      // Support @graph or top-level
      const nodes: Record<string, unknown>[] = Array.isArray(data?.["@graph"])
        ? (data["@graph"] as Record<string, unknown>[])
        : [data as Record<string, unknown>];

      for (const node of nodes) {
        if (logoUrl) break;
        const logo = node?.logo as Record<string, string> | string | undefined;
        if (!logo) continue;
        if (typeof logo === "string" && logo.startsWith("http")) {
          logoUrl = logo;
        } else if (typeof logo === "object") {
          const url = (logo.url ?? logo.contentUrl ?? "") as string;
          if (url.startsWith("http")) logoUrl = url;
        }
      }
    } catch {
      // ignore
    }
  });

  return logoUrl;
}

// ─── og:image extraction ───────────────────────────────────────────────────────

function extractOgImage($: CheerioAPI): string | null {
  const og = $("meta[property='og:image']").attr("content");
  if (og && og.startsWith("http") && !shouldSkip(og, "")) return og;
  return null;
}

// ─── Public extractors ─────────────────────────────────────────────────────────

/** Extract logo URL — tries schema.org first, then DOM selectors */
export function extractLogo($: CheerioAPI, baseUrl: string): ScrapedImage | null {
  // 1. Schema.org (most reliable for WordPress)
  const schemaLogoUrl = extractSchemaLogo($);
  if (schemaLogoUrl) {
    return { source_url: schemaLogoUrl, role: "logo" };
  }

  // 2. DOM selectors
  for (const sel of LOGO_SELECTORS) {
    const el = $(sel).first();
    if (!el.length) continue;
    const { src, alt } = getImgAttrs(el);
    if (!src || src.startsWith("data:")) continue;
    const abs = toAbsolute(src, baseUrl);
    if (!abs) continue;
    return { source_url: abs, role: "logo", alt_text: alt || undefined };
  }

  return null;
}

// ─── Cover-image scoring (Step 3 of spec) ─────────────────────────────────────
//
// Scores every image candidate on the page. Higher = better match for cover.
//   +3  normalized alt/title contains full business name
//   +2  per city/location token matched in alt, title, or filename
//   +2  og:image meta tag matches this src exactly
//   +1  image sits in a hero/banner section or has the largest explicit dimensions

function scoreCandidate(
  src: string,
  alt: string,
  isHero: boolean,
  ogUrl: string | null,
  nameTokens: string[],
  cityTokens: string[],
): number {
  const altLow = alt.toLowerCase();
  const filename = (src.split("/").pop() ?? "")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]/g, " ")
    .toLowerCase();

  let score = 0;

  // Full business name match in alt/title
  if (nameTokens.length > 0) {
    const fullName = nameTokens.join(" ");
    if (altLow.includes(fullName)) score += 3;
  }

  // City token matches
  for (const token of cityTokens) {
    if (altLow.includes(token) || filename.includes(token)) score += 2;
  }

  // og:image bonus
  if (ogUrl && src === ogUrl) score += 2;

  // Hero/banner location bonus
  if (isHero) score += 1;

  return score;
}

/** Extract hero/cover image, optionally scored by business name and city */
export function extractCover(
  $: CheerioAPI,
  baseUrl: string,
  businessName?: string,
  city?: string,
): ScrapedImage | null {
  const ogUrl = extractOgImage($);
  const nameTokens = (businessName ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
  const cityTokens = (city ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const logoHints = /\blogo\b/i;

  interface Candidate { src: string; alt: string; score: number }
  const candidates: Candidate[] = [];
  const seenSrc = new Set<string>();

  const addCandidate = (src: string, alt: string, isHero: boolean) => {
    if (seenSrc.has(src)) return;
    seenSrc.add(src);
    // Exclude images that are clearly logos (only if we'll have a separate logo)
    if (logoHints.test(alt)) return;
    const score = scoreCandidate(src, alt, isHero, ogUrl, nameTokens, cityTokens);
    candidates.push({ src, alt, score });
  };

  // og:image as a candidate (gets +2 from scoreCandidate automatically)
  if (ogUrl) {
    const abs = toAbsolute(ogUrl, baseUrl);
    if (abs) addCandidate(abs, "", false);
  }

  // Hero/banner/slider images
  for (const sel of HERO_SELECTORS) {
    $(sel).each((_, rawEl) => {
      const el = $(rawEl);
      const { src, alt, w, h } = getImgAttrs(el);
      if (!src || shouldSkip(src, alt)) return;
      if (isTooSmall(w, h)) return;
      const abs = toAbsolute(src, baseUrl);
      if (!abs) return;
      addCandidate(abs, alt, true);
    });
  }

  // All other decent-size images (fallback pool)
  $("img").each((_, rawEl) => {
    const el = $(rawEl);
    const { src, alt, w, h } = getImgAttrs(el);
    if (!src || shouldSkip(src, alt)) return;
    if (isTooSmall(w, h)) return;
    if (w > 0 && w < 400) return;
    const abs = toAbsolute(src, baseUrl);
    if (!abs) return;
    addCandidate(abs, alt, false);
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return {
    source_url: best.src,
    role: "cover",
    alt_text: best.alt || undefined,
    match_score: best.score,
  };
}

/** Extract gallery images (up to MAX_GALLERY) */
export function extractGallery($: CheerioAPI, baseUrl: string): ScrapedImage[] {
  const images: ScrapedImage[] = [];

  // 1. Explicit gallery selectors
  for (const sel of GALLERY_SELECTORS) {
    $(sel).each((_, rawEl) => {
      if (images.length >= MAX_GALLERY) return;
      const el = $(rawEl);
      const { src, alt, w, h } = getImgAttrs(el);
      if (!src || shouldSkip(src, alt)) return;
      if (isTooSmall(w, h)) return;
      const abs = toAbsolute(src, baseUrl);
      if (!abs) return;
      images.push({ source_url: abs, role: "gallery", alt_text: alt || undefined });
    });
    if (images.length > 0) break;
  }

  // 2. Fallback: collect all decent-size content images
  if (images.length === 0) {
    $("img").each((_, rawEl) => {
      if (images.length >= MAX_GALLERY) return;
      const el = $(rawEl);
      const { src, alt, w, h } = getImgAttrs(el);
      if (!src || shouldSkip(src, alt)) return;
      if (isTooSmall(w, h)) return;
      if (w > 0 && w < 300) return; // skip small thumbnails
      const abs = toAbsolute(src, baseUrl);
      if (!abs) return;
      images.push({ source_url: abs, role: "gallery", alt_text: alt || undefined });
    });
  }

  return images;
}

/** Extract all images from a page, with optional name/city for cover scoring */
export function extractImages(
  $: CheerioAPI,
  baseUrl: string,
  businessName?: string,
  city?: string,
): ScrapedImage[] {
  const results: ScrapedImage[] = [];

  const logo = extractLogo($, baseUrl);
  if (logo) results.push(logo);

  const cover = extractCover($, baseUrl, businessName, city);
  if (cover) results.push({ ...cover, sort_order: 0 });

  const gallery = extractGallery($, baseUrl);
  gallery.forEach((img, i) => results.push({ ...img, sort_order: i + 1 }));

  return dedupeBy(results, (img) => img.source_url);
}
