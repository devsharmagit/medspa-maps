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

// Elements that commonly carry the hero/cover as a CSS background-image.
// Elementor/WordPress render sliders and section backgrounds this way, so they
// are invisible to <img>-only extraction — scan inline styles, Elementor
// data-settings and <style> blocks for these too.
const BG_SELECTORS = [
  "[class*='hero'][style*='background']",
  "[class*='banner'][style*='background']",
  "[class*='slider'][style*='background']",
  "[class*='slide'][style*='background']",
  "[class*='carousel'][style*='background']",
  "[class*='elementor'][style*='background-image']",
  "[class*='swiper-slide'][style*='background']",
  "section[style*='background-image']",
  "div[style*='background-image']",
];
const BG_URL_RE = /background-image\s*:\s*url\((['"]?)([^'")]+)\1\)/i;
const CSS_IMG_URL_RE = /url\(\s*['"]?([^'")]+\.(?:jpe?g|png|webp))(?:\?[^'")]*)?['"]?\s*\)/gi;
// Strong hero signals (the site's actual homepage hero/slider) outrank weaker
// "banner"-type promo images so the real cover wins score ties.
const HERO_FILENAME_STRONG = /(hero|slider|masthead|home[-_]?slider|homepage)/i;
const HERO_FILENAME_WEAK = /(banner|cover|header[-_]?bg|main[-_]?bg)/i;

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
  // decorative page furniture — dividers, section separators, ornaments
  // (e.g. "newsectionline.webp", "wave-divider.png", "gold-underline.svg")
  /divider/i,
  /separator/i,
  /section[-_]?line/i,
  /[-_.](line|underline|wave|swirl|ornament|flourish|squiggle)[-_.]/i,
  /pattern[-_.]/i,
  /texture[-_.]/i,
  // promotional / non-clinic content that must never enter the DB
  /promo/i,
  /sponsor/i,
  /newsletter/i,
  /subscribe/i,
  /coupon/i,
  /gift[-_]?card/i,
  /financing/i,
  /\baward/i,
  /\bbadge/i,
  /\bseal[-_.]/i,
  /accredited/i,
  /certified/i,
  /as[-_]?seen/i,
  /featured[-_]?in/i,
  /partner[-_]?logo/i,
  /\bpress[-_.]/i,
];

function shouldSkip(src: string, alt: string): boolean {
  // Always skip data: URIs
  if (src.startsWith("data:image/svg")) return true;
  if (src.startsWith("data:image/gif")) return true; // 1x1 tracking pixels
  return SKIP_PATTERNS.some((p) => p.test(src) || p.test(alt));
}

/** Extreme declared aspect ratios are banners/dividers, not content images */
function isDecorativeShape(w: number, h: number): boolean {
  return w > 0 && h > 0 && (w / h > 6 || h / w > 6);
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

  // og:image bonus — the site owner's own choice of representative image is
  // the strongest signal we have; weight it above hero-position + one city hit.
  if (ogUrl && src === ogUrl) score += 4;

  // Hero/banner location bonus
  if (isHero) score += 1;

  // Filename signals a hero/slider/cover image (e.g. "homepageslider2.webp").
  // A real slider/hero outranks a generic promotional "banner".
  if (HERO_FILENAME_STRONG.test(filename) || HERO_FILENAME_STRONG.test(src)) score += 3;
  else if (HERO_FILENAME_WEAK.test(filename) || HERO_FILENAME_WEAK.test(src)) score += 2;

  return score;
}

/** Extract hero/cover image, optionally scored by business name and city */
export function extractCover(
  $: CheerioAPI,
  baseUrl: string,
  businessName?: string,
  city?: string,
  logoUrl?: string | null,
): ScrapedImage | null {
  // Absolutize og:image up front so the score comparison (src === ogUrl)
  // matches the absolutized candidate URLs — previously a relative/differently
  // normalized og URL silently lost its bonus.
  const ogRaw = extractOgImage($);
  const ogUrl = ogRaw ? (toAbsolute(ogRaw, baseUrl) ?? ogRaw) : null;
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
  const preloadUrls = new Set<string>();

  const addCandidate = (src: string, alt: string, isHero: boolean) => {
    if (seenSrc.has(src)) return;
    seenSrc.add(src);
    // Never let the logo become the cover — including when og:image IS the logo
    // (they'd otherwise dedupe against the logo row and leave no cover at all).
    if (logoUrl && src === logoUrl) return;
    if (logoHints.test(alt) || logoHints.test(src)) return;
    const score = scoreCandidate(src, alt, isHero, ogUrl, nameTokens, cityTokens);
    candidates.push({ src, alt, score });
  };

  // og:image as a candidate (gets its +4 from scoreCandidate automatically)
  if (ogUrl) {
    addCandidate(ogUrl, "", false);
  }

  // Hero/banner/slider images
  for (const sel of HERO_SELECTORS) {
    $(sel).each((_, rawEl) => {
      const el = $(rawEl);
      const { src, alt, w, h } = getImgAttrs(el);
      if (!src || shouldSkip(src, alt)) return;
      if (isTooSmall(w, h) || isDecorativeShape(w, h)) return;
      const abs = toAbsolute(src, baseUrl);
      if (!abs) return;
      addCandidate(abs, alt, true);
    });
  }

  // CSS background-image heroes (Elementor/WordPress sliders & section
  // backgrounds) — invisible to <img> extraction, so scan inline styles,
  // Elementor data-settings JSON, and <style> blocks.
  const addBg = (rawUrl: string) => {
    if (!rawUrl) return;
    const clean = rawUrl.replace(/\\/g, "");
    if (shouldSkip(clean, "")) return;
    const abs = toAbsolute(clean, baseUrl);
    if (abs) addCandidate(abs, "", true);
  };
  for (const sel of BG_SELECTORS) {
    $(sel).each((_, rawEl) => {
      const m = ($(rawEl).attr("style") ?? "").match(BG_URL_RE);
      if (m) addBg(m[2]);
    });
  }
  $("[data-settings*='url']").each((_, rawEl) => {
    const raw = $(rawEl).attr("data-settings") ?? "";
    for (const m of raw.matchAll(/"url"\s*:\s*"([^"]+\.(?:jpe?g|png|webp)[^"]*)"/gi)) addBg(m[1]);
  });
  $("style").each((_, rawEl) => {
    const css = $(rawEl).text() ?? "";
    for (const m of css.matchAll(CSS_IMG_URL_RE)) addBg(m[1]);
  });
  // <link rel="preload" as="image"> — the site's own declared priority hero
  // (LCP), stable in <head> and immune to lazy-render variance. Recorded so we
  // can boost it decisively over incidental hero <img>s / content photos below.
  $("link[rel~='preload'],link[rel~='prefetch']").each((_, rawEl) => {
    const el = $(rawEl);
    const as = (el.attr("as") ?? "").toLowerCase();
    let href = el.attr("href") ?? "";
    if (!href) href = ((el.attr("imagesrcset") ?? "").split(",")[0] ?? "").trim().split(/\s+/)[0] ?? "";
    if (!href || !(as === "image" || /\.(jpe?g|png|webp|avif)(\?|$)/i.test(href))) return;
    const abs = toAbsolute(href.replace(/\\/g, ""), baseUrl);
    if (!abs || shouldSkip(abs, "")) return;
    preloadUrls.add(abs);
    addCandidate(abs, "", true);
  });

  // All other decent-size images (fallback pool)
  $("img").each((_, rawEl) => {
    const el = $(rawEl);
    const { src, alt, w, h } = getImgAttrs(el);
    if (!src || shouldSkip(src, alt)) return;
    if (isTooSmall(w, h) || isDecorativeShape(w, h)) return;
    if (w > 0 && w < 400) return;
    const abs = toAbsolute(src, baseUrl);
    if (!abs) return;
    addCandidate(abs, alt, false);
  });

  if (candidates.length === 0) return null;

  // The site's own preloaded hero is the strongest signal — let it win ties
  // against incidental hero <img>s / name-matching content photos.
  if (preloadUrls.size) {
    for (const c of candidates) if (preloadUrls.has(c.src)) c.score += 4;
  }

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
      if (isTooSmall(w, h) || isDecorativeShape(w, h)) return;
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
      if (isTooSmall(w, h) || isDecorativeShape(w, h)) return;
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

  const cover = extractCover($, baseUrl, businessName, city, logo?.source_url);
  if (cover) results.push({ ...cover, sort_order: 0 });

  // Keep the logo and cover OUT of the gallery, and never let a logo-looking
  // image sit in the gallery strip.
  const exclude = new Set(
    [logo?.source_url, cover?.source_url].filter(Boolean) as string[]
  );
  const gallery = extractGallery($, baseUrl).filter(
    (img) =>
      !exclude.has(img.source_url) &&
      !/\blogo\b/i.test(img.source_url) &&
      !/\blogo\b/i.test(img.alt_text ?? "")
  );
  gallery.forEach((img, i) => results.push({ ...img, sort_order: i + 1 }));

  return dedupeBy(results, (img) => img.source_url);
}

// ─── AI candidate collection ─────────────────────────────────────────────────
// Gather EVERY image URL on the page with light metadata (alt + where it sits),
// WITHOUT deciding roles — this is the candidate list the LLM chooses cover/
// logo/gallery from. The AI does the judgement; cheerio just supplies material.

export interface ImageCandidate {
  url: string;
  alt: string;
  /** where it appears: og-image | schema-logo | preload | header | hero | background | gallery | footer | body */
  context: string;
}

export function collectImageCandidates($: CheerioAPI, baseUrl: string): ImageCandidate[] {
  const out: ImageCandidate[] = [];
  const seen = new Set<string>();
  const MAX = 60;

  const add = (rawUrl: string, alt: string, context: string) => {
    if (out.length >= MAX || !rawUrl) return;
    const clean = rawUrl.replace(/\\/g, "").trim();
    if (!clean || clean.startsWith("data:")) return;
    if (shouldSkip(clean, alt)) return;
    const abs = toAbsolute(clean, baseUrl);
    if (!abs || seen.has(abs)) return;
    seen.add(abs);
    out.push({ url: abs, alt: (alt || "").replace(/\s+/g, " ").trim().slice(0, 100), context });
  };
  const addImgs = (sel: string, context: string) => {
    $(sel).each((_, el) => {
      const { src, alt } = getImgAttrs($(el));
      add(src, alt, context);
    });
  };

  // Declared / meta signals first — strongest hints for the AI.
  const og = extractOgImage($);
  if (og) add(og, "", "og-image");
  const schemaLogo = extractSchemaLogo($);
  if (schemaLogo) add(schemaLogo, "", "schema-logo");
  $("link[rel~='preload'],link[rel~='prefetch']").each((_, el) => {
    const as = ($(el).attr("as") ?? "").toLowerCase();
    let href = $(el).attr("href") ?? "";
    if (!href) href = (($(el).attr("imagesrcset") ?? "").split(",")[0] ?? "").trim().split(/\s+/)[0] ?? "";
    if (href && (as === "image" || /\.(jpe?g|png|webp|avif)(\?|$)/i.test(href))) add(href, "", "preload");
  });

  // Positional <img> groups (context tells the AI what each likely is).
  addImgs("header img, nav img, [class*='header'] img, [class*='navbar'] img, [class*='logo'] img", "header");
  for (const sel of HERO_SELECTORS) addImgs(sel, "hero");
  for (const sel of GALLERY_SELECTORS) addImgs(sel, "gallery");
  addImgs("footer img, [class*='footer'] img", "footer");

  // CSS background images (hero/section backgrounds; incl. <style> + data-settings).
  const addBg = (u: string) => add(u, "", "background");
  for (const sel of BG_SELECTORS) {
    $(sel).each((_, el) => {
      const m = ($(el).attr("style") ?? "").match(BG_URL_RE);
      if (m) addBg(m[2]);
    });
  }
  $("[data-settings*='url']").each((_, el) => {
    const raw = $(el).attr("data-settings") ?? "";
    for (const m of raw.matchAll(/"url"\s*:\s*"([^"]+\.(?:jpe?g|png|webp)[^"]*)"/gi)) addBg(m[1]);
  });
  $("style").each((_, el) => {
    const css = $(el).text() ?? "";
    for (const m of css.matchAll(CSS_IMG_URL_RE)) addBg(m[1]);
  });

  // Everything else that's left.
  addImgs("img", "body");

  return out;
}
