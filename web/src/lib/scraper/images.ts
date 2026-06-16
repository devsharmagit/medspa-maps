import type { CheerioAPI, Cheerio } from "cheerio";
import type { AnyNode } from "domhandler";
import type { ScrapedImage } from "./types";
import { toAbsolute, dedupeBy } from "./utils";

type CheerioEl = Cheerio<AnyNode>;

const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;
const MAX_GALLERY = 10;

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
  "[class*='hero-image']",
  "[class*='bg-image']",
  "section:first-of-type img",
];

const GALLERY_SELECTORS = [
  "[class*='gallery'] img",
  "[class*='portfolio'] img",
  "[class*='grid'] img",
  "[class*='masonry'] img",
];

const SKIP_PATTERNS = [
  /placeholder/i,
  /blank/i,
  /spacer/i,
  /pixel/i,
  /tracking/i,
  /data:image/i,
  /icon/i,
  /favicon/i,
  /arrow/i,
  /social/i,
  /logo.*icon/i,
  /sprite/i,
  /loading/i,
];

function shouldSkip(src: string, alt: string): boolean {
  return SKIP_PATTERNS.some((p) => p.test(src) || p.test(alt));
}

function getImgAttrs(el: CheerioEl): { src: string; alt: string; w: number; h: number } {
  const src =
    el.attr("src") ??
    el.attr("data-src") ??
    el.attr("data-lazy-src") ??
    el.attr("data-original") ??
    "";
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

/** Extract logo URL */
export function extractLogo($: CheerioAPI, baseUrl: string): ScrapedImage | null {
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

/** Extract hero/cover image */
export function extractCover($: CheerioAPI, baseUrl: string): ScrapedImage | null {
  for (const sel of HERO_SELECTORS) {
    const el = $(sel).first();
    if (!el.length) continue;
    const { src, alt, w, h } = getImgAttrs(el);
    if (!src || shouldSkip(src, alt)) continue;
    if (isTooSmall(w, h)) continue;
    const abs = toAbsolute(src, baseUrl);
    if (!abs) continue;
    return { source_url: abs, role: "cover", alt_text: alt || undefined };
  }

  // Fallback: first large image on page
  let cover: ScrapedImage | null = null;
  $("img").each((_, rawEl) => {
    if (cover) return;
    const el = $(rawEl);
    const { src, alt, w, h } = getImgAttrs(el);
    if (!src || shouldSkip(src, alt)) return;
    if (isTooSmall(w, h)) return;
    if (w > 0 && w < 400) return;
    const abs = toAbsolute(src, baseUrl);
    if (!abs) return;
    cover = { source_url: abs, role: "cover", alt_text: alt || undefined };
  });

  return cover;
}

/** Extract gallery images */
export function extractGallery($: CheerioAPI, baseUrl: string): ScrapedImage[] {
  const images: ScrapedImage[] = [];

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

  return images;
}

/** Extract all images from a page */
export function extractImages($: CheerioAPI, baseUrl: string): ScrapedImage[] {
  const results: ScrapedImage[] = [];

  const logo = extractLogo($, baseUrl);
  if (logo) results.push(logo);

  const cover = extractCover($, baseUrl);
  if (cover) results.push({ ...cover, sort_order: 0 });

  const gallery = extractGallery($, baseUrl);
  gallery.forEach((img, i) => results.push({ ...img, sort_order: i + 1 }));

  return dedupeBy(results, (img) => img.source_url);
}
