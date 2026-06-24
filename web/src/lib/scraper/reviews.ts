/**
 * Review scraper.
 *
 * Strategy (most reliable first):
 *   1. schema.org Review / AggregateRating nodes in JSON-LD (handles @graph).
 *   2. DOM fallback — testimonial/review/quote blocks with visible text.
 *
 * Many medspa sites embed a third-party Google reviews widget whose text is
 * not in the static HTML; in that case only the AggregateRating is recovered.
 */

import type { CheerioAPI } from "cheerio";
import { cleanText } from "./utils";

export interface ScrapedReview {
  reviewer_name?: string;
  rating?: number;
  body: string;
  source: string; // 'scraped'
  source_url?: string;
}

export interface ReviewExtraction {
  reviews: ScrapedReview[];
  aggregate?: { rating: number; count: number | null };
}

function clampRating(v: unknown): number | undefined {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  const r = Math.round(n);
  return r >= 1 && r <= 5 ? r : undefined;
}

function collectGraphNodes(data: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const walk = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node === "object") {
      out.push(node as Record<string, unknown>);
      const graph = (node as Record<string, unknown>)["@graph"];
      if (graph) walk(graph);
    }
  };
  walk(data);
  return out;
}

export function extractReviews($: CheerioAPI, pageUrl: string): ReviewExtraction {
  const reviews: ScrapedReview[] = [];
  let aggregate: ReviewExtraction["aggregate"];
  const seen = new Set<string>();

  // ── 1. JSON-LD ────────────────────────────────────────────────────────────
  $('script[type="application/ld+json"]').each((_, el) => {
    let data: unknown;
    try {
      data = JSON.parse($(el).text());
    } catch {
      return;
    }
    for (const node of collectGraphNodes(data)) {
      // Aggregate rating
      const agg = node.aggregateRating as Record<string, unknown> | undefined;
      if (agg && !aggregate) {
        const rating = Number(agg.ratingValue);
        const rawCount = agg.reviewCount ?? agg.ratingCount;
        const count = parseInt(String(rawCount ?? "").replace(/[^0-9]/g, ""), 10);
        if (Number.isFinite(rating)) {
          aggregate = { rating, count: Number.isFinite(count) ? count : null };
        }
      }
      // Individual reviews
      const revs = node.review;
      const list = Array.isArray(revs) ? revs : revs ? [revs] : [];
      for (const r of list as Record<string, unknown>[]) {
        const body = cleanText(
          (r.reviewBody as string) ?? (r.description as string) ?? ""
        );
        if (!body || body.length < 15) continue;
        const author = r.author as Record<string, unknown> | string | undefined;
        const reviewer_name = cleanText(
          typeof author === "string" ? author : (author?.name as string) ?? ""
        );
        const ratingNode = r.reviewRating as Record<string, unknown> | undefined;
        const rating = clampRating(ratingNode?.ratingValue);
        const key = body.slice(0, 80).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        reviews.push({
          reviewer_name: reviewer_name || undefined,
          rating,
          body,
          source: "scraped",
          source_url: pageUrl,
        });
      }
    }
  });

  // ── 2. DOM fallback for visible testimonials ───────────────────────────────
  if (reviews.length === 0) {
    const selectors = [
      "[class*=testimonial]",
      "[class*=review]",
      "blockquote",
      "[class*=quote]",
    ];
    $(selectors.join(",")).each((_, el) => {
      const $el = $(el);
      // skip if it contains nested testimonial blocks (take the leaf)
      if ($el.find("[class*=testimonial],[class*=review],blockquote").length > 0)
        return;
      const text = cleanText($el.text());
      if (text.length < 40 || text.length > 600) return;
      if (!/(love|amazing|great|recommend|staff|experience|professional|best|friendly|highly)/i.test(text))
        return;
      const key = text.slice(0, 80).toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      // a name often sits in a nearby heading/cite
      const name = cleanText(
        $el.find("cite, [class*=name], [class*=author], h4, h5, h6").first().text()
      );
      reviews.push({
        reviewer_name: name || undefined,
        body: text,
        source: "scraped",
        source_url: pageUrl,
      });
    });
  }

  return { reviews: reviews.slice(0, 50), aggregate };
}
