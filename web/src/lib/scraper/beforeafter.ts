/**
 * Before/After image scraper.
 *
 * Collects content images from a before-&-after gallery page (or the gallery
 * sections of a homepage), filtering out logos, icons, and decorative SVGs.
 * Returns ScrapedImage[] tagged role='before_after'.
 */

import type { CheerioAPI } from "cheerio";
import { toAbsolute, cleanText } from "./utils";
import type { ScrapedImage } from "./types";

const SKIP_RE =
  /(logo|icon|favicon|sprite|placeholder|avatar|badge|spacer|loader|carecredit|cherry|financing)/i;
const CONTENT_EXT_RE = /\.(jpe?g|png|webp)(\?|$)/i;

/**
 * Matches a filename/URL that is unambiguously a before-&-after image, e.g.
 * "Dysport-BeforeandAfter-Ruma.webp", "Botox-Before-After-B.webp",
 * "lips_before_after.jpg", "B&A-1.webp". A match = 100% confidence (no AI needed).
 */
export const BA_FILENAME_RE = /before[\s._-]*(and[\s._-]*)?after|beforeafter|b[\s._-]*&[\s._-]*a\b|\bb2a\b/i;

/** True when a URL/filename is a certain before/after image (per BA_FILENAME_RE). */
export function isBeforeAfterUrl(url: string): boolean {
  return BA_FILENAME_RE.test(url);
}

export function extractBeforeAfter(
  $: CheerioAPI,
  baseUrl: string
): ScrapedImage[] {
  const out: ScrapedImage[] = [];
  const seen = new Set<string>();
  let order = 0;

  const pushImg = (rawSrc: string | undefined, alt: string | undefined) => {
    if (!rawSrc) return;
    const abs = toAbsolute(rawSrc, baseUrl);
    if (!abs) return;
    if (SKIP_RE.test(abs)) return;
    if (!CONTENT_EXT_RE.test(abs)) return; // skip svg/gif/data-uri
    if (seen.has(abs)) return;
    seen.add(abs);
    out.push({
      source_url: abs,
      role: "before_after",
      alt_text: cleanText(alt) || undefined,
      sort_order: order++,
    });
  };

  // Prefer images inside gallery/before-after containers; fall back to all imgs.
  const containers = $(
    '[class*=gallery], [class*=before], [class*=after], [class*=ba-], [id*=gallery]'
  );
  const scope = containers.length > 0 ? containers.find("img") : $("img");

  scope.each((_, el) => {
    const $el = $(el);
    // Real URL may live in a lazy-load attribute; static src is often a
    // base64 placeholder. Try the lazy attrs first, then srcset, then src.
    const srcset = $el.attr("data-lzl-srcset") || $el.attr("srcset") || "";
    const src =
      $el.attr("data-lzl-src") ||
      $el.attr("data-src") ||
      $el.attr("data-lazy-src") ||
      $el.attr("data-large_image") ||
      (srcset ? srcset.trim().split(/[\s,]+/)[0] : undefined) ||
      $el.attr("src");
    pushImg(src, $el.attr("alt"));
  });

  return out.slice(0, 40);
}
