import type { CheerioAPI } from "cheerio";
import type { ScrapedService } from "./types";
import { cleanText, slugify, parsePrice, parseDuration, dedupeBy } from "./utils";

const SERVICE_CONTAINER_SELECTORS = [
  "[class*='service-item']",
  "[class*='treatment-item']",
  "[class*='service-card']",
  "[class*='treatment-card']",
  "[class*='menu-item']",
  "[class*='procedure-item']",
  "[class*='service__item']",
  "[class*='treatment__item']",
  "[class*='service-block']",
  "[class*='treatment-block']",
  ".service",
  ".treatment",
  ".procedure",
  ".menu-item",
];

/** Extract services from a page */
export function extractServices($: CheerioAPI, pageUrl: string): ScrapedService[] {
  const services: ScrapedService[] = [];

  // Strategy 1: Find structured service cards
  for (const containerSel of SERVICE_CONTAINER_SELECTORS) {
    const containers = $(containerSel);
    if (containers.length < 2) continue;

    containers.each((_, rawEl) => {
      const container = $(rawEl);
      const name = extractServiceName($, container);
      if (!name || name.length < 3 || name.length > 80) return;

      const slug = slugify(name);
      if (!slug) return;

      const priceRaw = extractServicePrice($, container);
      const { from, to, notes, varies } = priceRaw
        ? parsePrice(priceRaw)
        : { from: null, to: null, notes: null, varies: false };

      const description = extractServiceDescription($, container, name);
      const durationRaw = extractDuration($, container);
      const duration = durationRaw ? parseDuration(durationRaw) : null;

      services.push({
        name: name.trim(),
        slug,
        description: description || undefined,
        price_from: from ?? undefined,
        price_to: to ?? undefined,
        price_notes: notes ?? undefined,
        price_varies: varies || undefined,
        duration_minutes: duration ?? undefined,
      });
    });

    if (services.length > 0) break;
  }

  // Strategy 2: Heading-based extraction on services page
  if (services.length === 0) {
    services.push(...extractFromHeadings($, pageUrl));
  }

  // Strategy 3: List items on a services page
  if (services.length === 0) {
    services.push(...extractFromList($));
  }

  return dedupeBy(
    services.filter((s) => isLikelyService(s.name)),
    (s) => s.slug
  );
}

type CheerioWrapped = ReturnType<CheerioAPI>;

function extractServiceName($: CheerioAPI, container: CheerioWrapped): string | null {
  const selectors = ["h1", "h2", "h3", "h4", "h5", "[class*='title']", "[class*='name']"];
  for (const sel of selectors) {
    const text = cleanText(container.find(sel).first().text());
    if (text && text.length > 2) return text;
  }
  return null;
}

function extractServicePrice($: CheerioAPI, container: CheerioWrapped): string | null {
  void $; // suppress unused warning
  const selectors = ["[class*='price']", "[class*='cost']", "[class*='fee']", "[class*='rate']", "strong"];
  for (const sel of selectors) {
    const text = cleanText(container.find(sel).first().text());
    if (text && /\$/.test(text)) return text;
  }
  return null;
}

function extractServiceDescription($: CheerioAPI, container: CheerioWrapped, name: string): string | null {
  void $;
  const selectors = ["p", "[class*='desc']", "[class*='text']", "[class*='content']"];
  for (const sel of selectors) {
    const text = cleanText(container.find(sel).first().text());
    if (text && text.length > 20 && text !== name) return text;
  }
  return null;
}

function extractDuration($: CheerioAPI, container: CheerioWrapped): string | null {
  void $;
  const allText = cleanText(container.text());
  const m = allText.match(/(\d+)\s*(?:min(?:utes?)?|hr|hours?)/i);
  return m ? m[0] : null;
}

function extractFromHeadings($: CheerioAPI, pageUrl: string): ScrapedService[] {
  const services: ScrapedService[] = [];
  const isServicePage =
    /\/(service|treatment|menu|procedure)/i.test(pageUrl) ||
    /service|treatment|menu|procedure/i.test($("h1").text());

  if (!isServicePage) return services;

  $("h2, h3").each((_, rawEl) => {
    const el = $(rawEl);
    const name = cleanText(el.text());
    if (!name || name.length < 3 || name.length > 80) return;
    if (!isLikelyService(name)) return;

    const slug = slugify(name);
    if (!slug) return;

    const next = el.next("p");
    const description = next.length ? cleanText(next.text()) || undefined : undefined;

    let priceRaw: string | null = null;
    if (/\$/.test(name)) {
      priceRaw = name;
    } else {
      const nearbyText = el.nextAll().slice(0, 3).text();
      if (/\$/.test(nearbyText)) priceRaw = nearbyText;
    }

    const { from, to, notes, varies } = priceRaw
      ? parsePrice(priceRaw)
      : { from: null, to: null, notes: null, varies: false };

    services.push({
      name: name.replace(/\$[\d,.-]+/g, "").trim(),
      slug,
      description: description && description.length > 20 ? description : undefined,
      price_from: from ?? undefined,
      price_to: to ?? undefined,
      price_notes: notes ?? undefined,
      price_varies: varies || undefined,
    });
  });

  return services;
}

function extractFromList($: CheerioAPI): ScrapedService[] {
  const services: ScrapedService[] = [];

  $("ul, ol").each((_, listEl) => {
    const items: ScrapedService[] = [];
    $(listEl).find("li").each((_, rawLi) => {
      const text = cleanText($(rawLi).text());
      if (!text || text.length < 3 || text.length > 100) return;
      if (!isLikelyService(text)) return;
      const slug = slugify(text);
      if (!slug) return;
      items.push({ name: text, slug });
    });

    if (items.length >= 3) {
      services.push(...items);
      return false; // break
    }
  });

  return services;
}

function isLikelyService(name: string): boolean {
  const lower = name.toLowerCase();
  const blacklist = [
    "home", "about", "contact", "gallery", "blog", "faq", "testimonials",
    "privacy", "terms", "sitemap", "login", "cart", "menu", "navigation",
    "read more", "learn more", "click here", "schedule", "book now",
    "call us", "get started", "view all", "see all", "copyright",
    "follow us", "sign up", "subscribe", "newsletter",
  ];
  if (blacklist.some((b) => lower === b || lower === b + "s")) return false;
  if (!/[a-z]/i.test(name)) return false;
  if (name.length < 3) return false;
  return true;
}
