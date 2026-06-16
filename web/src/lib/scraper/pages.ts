import type { CheerioAPI } from "cheerio";
import { toAbsolute } from "./utils";

/**
 * Discover relevant sub-pages to scrape by inspecting navigation links.
 * Returns a map of { type → url } for the most relevant pages.
 */
export function discoverPages(
  $: CheerioAPI,
  baseUrl: string
): { services: string | null; team: string | null; about: string | null; contact: string | null } {
  const links: Array<{ href: string; text: string }> = [];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const text = ($(el).text() ?? "").toLowerCase().trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

    const abs = toAbsolute(href, baseUrl);
    if (!abs) return;

    // Only follow same-domain links
    try {
      if (new URL(abs).hostname !== new URL(baseUrl).hostname) return;
    } catch {
      return;
    }

    links.push({ href: abs, text });
  });

  const find = (patterns: RegExp[]): string | null => {
    // First try matching against the href path
    for (const { href, text } of links) {
      const path = (() => { try { return new URL(href).pathname.toLowerCase(); } catch { return ""; } })();
      for (const pat of patterns) {
        if (pat.test(path) || pat.test(text)) return href;
      }
    }
    return null;
  };

  return {
    services: find([
      /\/(services|treatments|menu|procedures|what-we-offer|our-services|med-spa-services|medspa-services|treatment)/,
    ]),
    team: find([
      /\/(team|providers|staff|our-team|meet-the-team|practitioners|specialists|doctors|injectors)/,
    ]),
    about: find([
      /\/(about|about-us|our-story|who-we-are)/,
    ]),
    contact: find([
      /\/(contact|contact-us|get-in-touch|location|locations)/,
    ]),
  };
}

/** Returns URL candidates to try for a given page type */
export function pageGuesses(baseUrl: string, type: "services" | "team" | "contact"): string[] {
  const base = baseUrl.replace(/\/$/, "");
  switch (type) {
    case "services":
      return [
        `${base}/services`,
        `${base}/treatments`,
        `${base}/menu`,
        `${base}/procedures`,
        `${base}/our-services`,
      ];
    case "team":
      return [
        `${base}/team`,
        `${base}/our-team`,
        `${base}/providers`,
        `${base}/staff`,
        `${base}/about/team`,
        `${base}/about-us/team`,
      ];
    case "contact":
      return [
        `${base}/contact`,
        `${base}/contact-us`,
        `${base}/locations`,
        `${base}/location`,
      ];
  }
}
