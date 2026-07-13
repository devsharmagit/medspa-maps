/**
 * ingest/before-after.ts — collect a clinic's Before/After photos.
 *
 * Shared by the full website ingest ([ingest-clinic.ts]) and the standalone
 * B&A-only refresh ([ingest-before-after.ts]) so the (fiddly) classification and
 * labelling logic lives in ONE place.
 *
 * Classification (cap BA_CAP/clinic — matches the approved plan):
 *   CERTAIN   — filename matches the before-after pattern, OR the image sits on a
 *               DEDICATED before-and-after page (no AI).
 *   UNCERTAIN — image from a generic gallery/results page with no filename signal
 *               → one bounded AI-vision classify call decides.
 *
 * Load-bearing: results MUST be de-duped against the clinic's cover/logo/gallery
 * URLs. The images unique key is (entity_type, entity_id, source_url) — role is
 * NOT in it — so a URL shared with an earlier-inserted gallery row would make the
 * before_after insert a silent no-op (ON CONFLICT DO NOTHING).
 */

import type { CheerioAPI } from "cheerio";
import { collectImageCandidates, type ImageCandidate } from "@/lib/scraper/images";
import { extractBeforeAfter, isBeforeAfterUrl } from "@/lib/scraper/beforeafter";
import type { ScrapedImage } from "@/lib/scraper/types";
import type { SaveImageRef } from "@/lib/admin/clinic-save";
import { classifyBeforeAfterImages } from "@/lib/ingest/ai-extract";

export const BA_CAP = 10;

// Pages that tend to hold B&A photos. "gallery"/"results" are generic but are
// exactly where B&A lives; the per-image filename heuristic + AI fallback keep
// precision. DEDICATED = the path itself says "before … after" → trust every
// image on it (that is exactly what extractBeforeAfter assumes).
const BA_PAGE_RE = /(before-?and-?after|before-?after|beforeafter|gallery|results|transformations)/i;
const BA_DEDICATED_RE = /before[\s._-]*(and[\s._-]*)?after|beforeafter/i;

export interface BeforeAfterCandidates {
  certain: Map<string, ScrapedImage>;
  uncertain: Map<string, { url: string; alt: string | null }>;
}

export function newBeforeAfterCandidates(): BeforeAfterCandidates {
  return { certain: new Map(), uncertain: new Map() };
}

function addBA(c: BeforeAfterCandidates, img: ScrapedImage, dedicated: boolean): void {
  const url = img.source_url;
  if (!url || c.certain.has(url) || c.uncertain.has(url)) return;
  if (dedicated || isBeforeAfterUrl(url)) c.certain.set(url, img);
  else c.uncertain.set(url, { url, alt: img.alt_text ?? null });
}

/**
 * Scan ONE already-loaded page for B&A candidates, mutating `c`:
 *  - filename-certain images anywhere on the page (homepage included);
 *  - when the page URL looks like a B&A/gallery page, ALL its content images via
 *    extractBeforeAfter — trusted as CERTAIN only on a dedicated B&A page.
 *
 * `opts.isHome` suppresses the gallery sweep on the homepage (it would grab every
 * hero/section image); only filename-certain matches are taken there.
 * `opts.candidates` lets a caller pass an already-collected candidate list so the
 * page isn't walked twice (the full ingest reuses its list).
 */
export function scanPageForBeforeAfter(
  c: BeforeAfterCandidates,
  $: CheerioAPI,
  url: string,
  opts: { isHome?: boolean; candidates?: ImageCandidate[] } = {}
): void {
  const cands = opts.candidates ?? collectImageCandidates($, url);
  for (const cand of cands) {
    if (isBeforeAfterUrl(cand.url)) {
      addBA(c, { source_url: cand.url, role: "before_after", alt_text: cand.alt || undefined, sort_order: 0 }, false);
    }
  }
  if (!opts.isHome && BA_PAGE_RE.test(url)) {
    const dedicated = BA_DEDICATED_RE.test(url);
    for (const img of extractBeforeAfter($, url)) addBA(c, img, dedicated);
  }
}

// Filename tokens that never name a treatment.
const BA_STOP = new Set([
  "before", "after", "beforeandafter", "beforeafter", "and", "the", "an",
  "image", "images", "img", "imgs", "picture", "pictures", "pic", "pics",
  "photo", "photos", "treatment", "treatments", "result", "results",
  "patient", "patients", "gallery", "scaled", "final", "copy", "edited",
  "new", "example", "sample", "ba", "b2a", "of", "vs",
]);
const BA_ANCHOR = /^(beforeandafter|beforeafter|before|after)$/i;

/** Single-letter index ("-a"), pure number, or long opaque CDN slug — not a word. */
function isHashToken(t: string): boolean {
  if (/^[a-z]$/i.test(t) || /^\d+$/.test(t)) return true;
  return t.length >= 10 && /\d/.test(t) && /[a-z]/i.test(t);
}
function isTreatmentToken(t: string): boolean {
  return !!t && /[A-Za-z]/.test(t) && !BA_STOP.has(t.toLowerCase()) && !isHashToken(t);
}

/**
 * Pull a treatment label out of a B&A filename, handling BOTH conventions:
 * treatment-before-anchor (`Dysport-BeforeandAfter-Ruma`) and treatment-after-
 * anchor (`Before-and-After-Botox-k-<hash>`). Prefers the contiguous run of real
 * words just before the first anchor, else just after the last, capped to 2 words.
 */
function treatmentFromFilename(file: string): string | null {
  const stem = file.replace(/\.[a-z0-9]+$/i, "");
  const tokens = stem.split(/[-_ ]+/).filter(Boolean);
  const anchors = tokens.map((t, i) => (BA_ANCHOR.test(t) ? i : -1)).filter((i) => i >= 0);
  if (anchors.length === 0) return null;

  const back: string[] = [];
  for (let i = anchors[0] - 1; i >= 0 && back.length < 5 && isTreatmentToken(tokens[i]); i--) {
    back.unshift(tokens[i]);
  }
  const fwd: string[] = [];
  for (let i = anchors[anchors.length - 1] + 1; i < tokens.length && fwd.length < 5 && isTreatmentToken(tokens[i]); i++) {
    fwd.push(tokens[i]);
  }
  const words = (back.length ? back : fwd).slice(0, 2);
  return words.length ? words.join(" ") : null;
}

/** An alt string that's just "before & after" boilerplate or a raw filename. */
function isGenericAlt(alt: string): boolean {
  const t = alt.trim();
  if (/^before\s*&?\s*and?\s*after/i.test(t)) return true;
  // filename-looking (no spaces, hyphen/underscore-joined around before/after)
  return !/\s/.test(t) && /[-_]/.test(t) && /before|after/i.test(t);
}

/** Caption a B&A tile: treatment from the filename first (site alts are usually
 *  one generic SEO string repeated on every image), then a non-generic alt, then
 *  the clinic name. */
function baLabel(url: string, alt: string | null, fallbackName: string): string {
  const file = (url.split("/").pop() ?? "").split(/[?#]/)[0];
  const treatment = treatmentFromFilename(file);
  if (treatment) return `${treatment} before & after`;
  if (alt && alt.trim() && !isGenericAlt(alt)) return alt.trim();
  return `${fallbackName} before & after`;
}

/**
 * Resolve collected candidates into save-ready before_after rows: de-dup against
 * `excludeUrls` (cover/logo/gallery), AI-classify the uncertain ones only when
 * there's room under the cap, label each, cap at BA_CAP.
 */
export async function resolveBeforeAfter(
  c: BeforeAfterCandidates,
  opts: { excludeUrls?: Iterable<string>; businessName?: string; domain: string }
): Promise<SaveImageRef[]> {
  const taken = new Set<string>(opts.excludeUrls ?? []);
  const fallbackName = opts.businessName ?? opts.domain;

  const uncertainList = [...c.uncertain.values()].filter((u) => !taken.has(u.url));
  let confirmed = new Set<string>();
  if (uncertainList.length > 0 && c.certain.size < BA_CAP) {
    confirmed = new Set(await classifyBeforeAfterImages(uncertainList));
  }

  const out: SaveImageRef[] = [];
  const seen = new Set<string>();
  const push = (url: string, alt: string | null) => {
    if (out.length >= BA_CAP || !url || seen.has(url) || taken.has(url)) return;
    seen.add(url);
    out.push({ source_url: url, alt_text: baLabel(url, alt, fallbackName) });
  };
  for (const img of c.certain.values()) push(img.source_url, img.alt_text ?? null);
  for (const u of uncertainList) if (confirmed.has(u.url)) push(u.url, u.alt);
  return out;
}
