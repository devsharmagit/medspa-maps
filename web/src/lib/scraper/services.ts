import type { CheerioAPI } from "cheerio";
import type { ScrapedService } from "./types";
import { cleanText, slugify, parsePrice, parseDuration, dedupeBy } from "./utils";

// ─── Nav-link service extraction (Step 2 of spec) ─────────────────────────────
//
// Scans every <nav> element for <a href> links whose path matches /services?/.
// This is the primary extraction strategy — it captures the full treatment
// catalogue that medspa sites link in their navigation, including deeply-nested
// sub-menus (Services > Injectables > Botox®).

/**
 * Extract services by scanning <nav> links for /services?/{slug}/ URL patterns.
 *
 * Rules (per spec):
 *  - Skip #, tel:, mailto:, empty href
 *  - Skip if resolved hostname != scraped domain
 *  - Skip if path doesn't contain /services?/
 *  - Skip if path after stripping /services?/ prefix is empty (index page)
 *  - Dedupe by absolute URL
 *  - raw_name = link visible text
 *  - category = nearest ancestor menu-group label (grandparent <li>'s <a> text)
 *  - is_category = true when the link's own <li> has child sub-menu items
 */
// Words/phrases that appear as menu links but are NOT services.
const NON_SERVICE = new Set([
  "about", "about us", "team", "training", "partners", "careers", "policies",
  "services", "results", "specials", "gift card", "gift cards", "contact",
  "contact us", "home", "reviews", "skip to content", "login", "log in",
  "sign up", "sign in", "book", "book now", "book appointment", "appointment",
  "blog", "blogs", "shop", "store", "menu", "search", "privacy", "privacy policy",
  "terms", "terms and conditions", "faq", "faqs", "our story", "our team",
  "location", "locations", "hours", "pricing", "financing", "membership",
  "memberships", "gallery", "before & after", "before and after", "before after",
  "before & after images", "before and after images", "specials & events",
  "new patients", "patient portal", "portal", "events", "press", "media",
  "instagram", "facebook", "tiktok", "youtube", "promotions", "rewards",
  "consultation", "free consultation", "our lehi location", "skin quiz",
  "book a consultation", "get to know me", "more services", "view all services",
  "all services", "meet the team", "meet our team",
  // structural / non-service page links
  "accessibility statement", "book a visit", "model inquiry", "monthly specials",
  "opt out of targeted ads", "our medical practice", "payment plans",
  "vip programs", "vip program", "accessibility", "all services", "view services",
  // RUMA section headers (categories, not services)
  "functional wellness", "medical aesthetics", "skin health", "sexual wellness",
  "wellness", "aesthetics", "injectables", "infusions", "injections",
]);

// street-address suffixes — anchors containing these + a number aren't services
const ADDRESS_RE = /\b(ste|suite|blvd|ave|avenue|rd|road|dr|drive|ln|lane|hwy|pkwy)\b/i;

/**
 * Harvest service names from menu/nav anchor *text* (not just URL patterns).
 * Many sites (e.g. WordPress mega-menus) list their full catalogue as anchor
 * text without a /services/ URL pattern, so extractServicesFromNav misses them.
 * Filtered against a non-service stoplist.
 */
export function extractServiceAnchors($: CheerioAPI, _baseUrl: string): ScrapedService[] {
  const out: ScrapedService[] = [];
  const seen = new Set<string>();
  let baseDomain = "";
  try {
    baseDomain = new URL(_baseUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {}
  $("a").each((_, el) => {
    const link = $(el);
    const text = cleanText($(el).text());
    if (!text) return;
    const lower = text.toLowerCase();
    if (text.length < 3 || text.length > 60) return;
    if (!/[a-zA-Z]/.test(text)) return;
    if (NON_SERVICE.has(lower)) return;
    // skip nav toggles like "Open Services" / "Close Results"
    if (/^(open|close)\s/i.test(text)) return;
    // skip obvious sentences / CTAs
    if (/[.!?]$/.test(text) || /\b(learn more|read more|view all|see all|get started|click here)\b/i.test(lower)) return;
    if (lower.includes("schedule") || lower.includes("call ")) return;
    // skip emails, phone numbers, and street addresses
    if (lower.includes("@")) return;
    if (/\d{4,}/.test(text)) return; // zip / street number / phone
    if (ADDRESS_RE.test(text) && /\d/.test(text)) return;
    // skip "Our X" / "The X" structural labels
    if (/^(our|the)\s/i.test(text) && !/therapy|treatment|facial|peel|laser/i.test(lower)) return;
    const slug = slugify(text);
    if (!slug || seen.has(slug)) return;

    const href = (link.attr("href") ?? "").trim();
    let abs: string | undefined;
    if (href && !/^(#|tel:|mailto:|javascript:)/i.test(href)) {
      try {
        const u = new URL(href, _baseUrl);
        const host = u.hostname.replace(/^www\./, "").toLowerCase();
        const path = u.pathname.toLowerCase();
        if (
          host === baseDomain &&
          !/\/(blog|news|shop|cart|checkout|privacy|terms|contact|about|team|locations?)(\/|$)/i.test(path)
        ) {
          abs = u.href;
        }
      } catch {}
    }

    seen.add(slug);
    out.push({
      name: text,
      slug,
      category: findAncestorMenuLabel(link) ?? undefined,
      scraped_from_url: abs,
    });
  });
  return out;
}

export function extractServicesFromNav($: CheerioAPI, baseUrl: string): ScrapedService[] {
  let baseDomain: string;
  try {
    baseDomain = new URL(baseUrl).hostname;
  } catch {
    return [];
  }

  const seen = new Set<string>();
  const services: ScrapedService[] = [];

  $("nav").each((_, navEl) => {
    $(navEl)
      .find("a[href]")
      .each((_, linkEl) => {
        const link = $(linkEl);
        const href = (link.attr("href") ?? "").trim();
        if (!href || /^(#|tel:|mailto:)/i.test(href)) return;

        let abs: string;
        try {
          abs = new URL(href, baseUrl).href;
        } catch {
          return;
        }

        let urlObj: URL;
        try {
          urlObj = new URL(abs);
        } catch {
          return;
        }

        // Same domain only
        if (urlObj.hostname !== baseDomain) return;

        // Path must contain /service(s)/
        if (!/\/services?\//i.test(urlObj.pathname)) return;

        // Path after stripping /services?/ prefix must be non-empty (exclude index page)
        const afterServices = urlObj.pathname
          .replace(/^.*?\/services?\//i, "")
          .replace(/\/+$/, "")
          .trim();
        if (!afterServices) return;

        // Dedupe by full URL (same treatment often appears in multiple nav sections)
        if (seen.has(abs)) return;
        seen.add(abs);

        const rawName = cleanText(
          link.text() || link.attr("aria-label") || link.attr("title") || ""
        );
        if (!rawName || rawName.length < 2 || rawName.length > 120) return;

        const slug = slugify(rawName);
        if (!slug) return;

        // Is this a category page (has its own sub-menu children)?
        const parentLi = link.closest("li");
        const isCategory = parentLi.length > 0 && parentLi.find("ul a[href]").length > 0;

        // Find category label from grandparent <li>
        const category = findAncestorMenuLabel(link);

        services.push({
          name: rawName,
          slug,
          category: category ?? undefined,
          scraped_from_url: abs,
          is_category: isCategory || undefined,
        });
      });
  });

  return services;
}

/**
 * Walk up from a nav link to find its parent menu-group label.
 *
 * Typical WordPress/Elementor nav structure:
 *   <li class="menu-item-has-children">      <- category item
 *     <a href="/services/injectables/">Injectables</a>
 *     <ul class="sub-menu">
 *       <li><a href="/services/injectables/botox/">Botox</a></li>  <- leaf
 *     </ul>
 *   </li>
 *
 * Returns the category link text, or null if not nested.
 */
function findAncestorMenuLabel(link: ReturnType<CheerioAPI>): string | null {
  const itemLi = link.closest("li");
  if (!itemLi.length) return null;

  const subMenu = itemLi.parent(); // should be <ul>
  if (!subMenu.length) return null;

  const categoryLi = subMenu.parent(); // should be parent <li>
  if (!categoryLi.length) return null;

  const tag = (categoryLi.prop("tagName") as string | undefined)?.toLowerCase();
  if (tag !== "li") return null;

  const label = cleanText(categoryLi.children("a").first().text());
  return label || null;
}

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
    // Navigation / UI
    "home", "about", "contact", "gallery", "blog", "faq", "testimonials",
    "privacy", "terms", "sitemap", "login", "cart", "menu", "navigation",
    "read more", "learn more", "click here", "view all", "see all",
    "copyright", "all rights reserved",
    // CTAs
    "schedule", "book now", "book appointment", "book a consultation",
    "call us", "get started", "contact us", "get in touch", "reach out",
    "follow us", "sign up", "subscribe", "newsletter",
    "schedule now", "schedule your treatment", "schedule your appointment",
    "ready to schedule", "book today",
    // Hours / location blocks
    "business hours", "hours of operation", "open hours",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    // Invitation / greeting phrases
    "you are invited", "visit us", "welcome",
  ];
  if (blacklist.some((b) => lower === b || lower === b + "s" || lower.startsWith(b + " "))) return false;
  // Too short or not text
  if (!/[a-z]/i.test(name)) return false;
  if (name.length < 3) return false;
  // Looks like a standalone city/state name (no brand/treatment word)
  // e.g. "Abilene", "Brownwood" — but NOT "Facials", "Skincare", "Toxin"
  const KNOWN_SERVICES_SINGLEWORD = new Set([
    "botox", "dysport", "xeomin", "jeuveau", "daxxify", "sculptra", "radiesse",
    "facials", "facial", "skincare", "toxin", "toxins", "fillers", "filler",
    "kybella", "ultherapy", "coolsculpting", "morpheus8", "sofwave",
    "prp", "prf", "microneedling", "hydrafacial", "dermaplaning",
    "peels", "lashes", "waxing", "threading",
    "nutraceuticals", "peptides", "injections", "infusions",
  ]);
  if (
    /^[A-Z][a-z]+(,?\s[A-Z]{2})?$/.test(name) &&
    name.split(" ").length <= 2 &&
    !KNOWN_SERVICES_SINGLEWORD.has(lower)
  ) return false;
  return true;
}
