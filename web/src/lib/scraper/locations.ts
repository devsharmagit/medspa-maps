/**
 * locations.ts
 *
 * Detects whether a medspa website lists multiple physical locations and
 * returns one ScrapedLocation per location.
 *
 * Strategy (in priority order):
 *   0. Footer / contact-page structured text — "City\nPhone:...\nEmail:...\nAddress:..." blocks
 *   1. Schema.org JSON-LD — multiple LocalBusiness / @graph entries
 *   2. Repeated address-block DOM patterns (cards, sections)
 *   3. /locations page if it exists
 *   4. Fallback: single location from merged contact data
 */

import type { CheerioAPI } from "cheerio";
import type { ScrapedLocation, HoursEntry, ScrapeContact } from "./types";
import { fetchHtml, load, toAbsolute, cleanText, parseAddress } from "./utils";
import { extractPhone, extractEmail, extractHours, collectMapsLinks, sanitizeMapsUrl, mapsUrlQuality, type MapsLink } from "./contact";

// ─── Footer / contact-page text block parser ──────────────────────────────────
//
// Detects patterns like:
//   Abilene
//   Phone: 325-280-0984
//   Email: dr.sara@example.com
//   Address: 642 Sayles Blvd. Abilene, TX 79605
//
//   Brownwood
//   Phone: 325-998-4566
//   Email: beautybusbrownwood@gmail.com
//   Address: 1001 Main st. Brownwood, TX 76801

interface TextBlock {
  city: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  state: string | null;
  zip: string | null;
  street: string | null;
}

/**
 * Parse a freeform text string for repeated {city, phone, email, address} blocks.
 *
 * Works on both:
 *   - Newline-separated text (raw DOM text)
 *   - Single-line collapsed text from cleanText() e.g.:
 *     "AbilenePhone: 325-280-0984Email: dr.sara@...Address: 642 Sayles Blvd..."
 */
function parseLocationBlocks(rawText: string): TextBlock[] {
  // Normalize: insert newlines before label keywords so block structure is visible
  // even in cleanText()-collapsed single-line strings.
  const normalized = rawText
    .replace(/\s*(Phone|Email|Address)\s*:/gi, "\n$1:")  // newline before each label
    .replace(/(\d{5})\s*([A-Z])/g, "$1\n$2")            // newline after zip (city separator, handles no-space)
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Split into lines and scan forward, grouping into blocks.
  // A new block starts whenever we see a city-like line (title-case, no digits, no colon).
  const lines = normalized.split("\n").map((l) => l.trim()).filter(Boolean);

  const LABEL_RE = /^(Phone|Email|Address|Location|Hours|Working|Contact|Schedule|Booking|Book|Mon|Tue|Wed|Thu|Fri|Sat|Sun):/i;
  const PHONE_RE = /^Phone:\s*([\d()\-\s.+]{7,20})/i;
  const EMAIL_RE = /^Email:\s*([^\s]+@[^\s]+)/i;
  const ADDR_RE  = /^Address:\s*(.+)/i;
  const CITY_RE  = /^[A-Z][a-zA-Z\s\-&']{1,40}$/;   // title-case, no digits, 2-42 chars
  // Marketing prose ("Your premier destination...") can pass CITY_RE — reject it.
  const PROSE_RE = /\b(premier|destination|heart|welcome|located|serving|experience|leading|trusted|home of|your|our|the best|aesthetic|wellness|medspa|med spa|clinic|beauty)\b/i;
  const isCityLine = (line: string) =>
    CITY_RE.test(line) &&
    !/\d/.test(line) &&
    line.split(/\s+/).length <= 3 &&
    !PROSE_RE.test(line);

  interface RawBlock { cityName: string; phone: string | null; email: string | null; address: string | null }
  const rawBlocks: RawBlock[] = [];
  let current: RawBlock | null = null;

  for (const line of lines) {
    // Detect a city-name line: not a label, not an email, a real city (not prose)
    if (!LABEL_RE.test(line) && !/@/.test(line) && isCityLine(line)) {
      // Start a new block
      if (current && (current.address || current.phone)) rawBlocks.push(current);
      current = { cityName: line, phone: null, email: null, address: null };
      continue;
    }

    if (!current) {
      // Haven't seen a city yet — create an unnamed block
      current = { cityName: "", phone: null, email: null, address: null };
    }

    const phoneM = PHONE_RE.exec(line);
    if (phoneM && !current.phone) { current.phone = phoneM[1].trim(); continue; }

    const emailM = EMAIL_RE.exec(line);
    if (emailM && !current.email) { current.email = emailM[1].trim(); continue; }

    const addrM = ADDR_RE.exec(line);
    if (addrM && !current.address) {
      // Truncate address at the first zip code (5 digits)
      let addr = addrM[1].replace(/©.*$/i, "").replace(/<[^>]+>/g, "").trim();
      const zipEnd = addr.match(/^(.*?\d{5})/);
      if (zipEnd) addr = zipEnd[1].trim();
      current.address = addr;
      continue;
    }
  }
  // Push last block
  if (current && (current.address || current.phone)) rawBlocks.push(current);

  // Convert to TextBlock
  return rawBlocks.map((b) => {
    const parsed = b.address ? parseAddress(b.address) : { city: null, state: null, zip: null, street: null };
    return {
      city: b.cityName || parsed.city || "",
      phone: b.phone,
      email: b.email,
      address: b.address,
      state: parsed.state,
      zip: parsed.zip,
      street: parsed.street,
    };
  });
}

/**
 * Scan the page DOM for elements likely containing structured location text,
 * extract TextBlocks, and return ScrapedLocations.
 * This is the highest-priority source — footer/contact page structured text beats schema.org.
 */
export function extractFromFooterText(
  $: CheerioAPI,
  html: string,
): ScrapedLocation[] {
  // Selectors ordered from most-specific to broadest.
  // Widget text editors on Elementor sites carry the best-structured location data.
  const candidates = [
    // WordPress/Elementor text widgets (most structured — contain Phone/Email/Address labels)
    "[class*='elementor-widget-text-editor'],[class*='widget-text'],[class*='text-widget']",
    // Contact page section containers
    "[class*='contact-info'],[class*='location-info'],[class*='locations-section']",
    // Main page body (contact page)
    "main,[class*='page-content'],[class*='entry-content']",
    // Footer
    "footer,[class*='elementor-location-footer'],[class*='site-footer']",
    // Generic sections
    "section,article",
    // Body as last resort
    "body",
  ];

  let globalBest: TextBlock[] = [];

  for (const sel of candidates) {
    let bestBlocks: TextBlock[] = [];

    $(sel).each((_, el) => {
      const text = cleanText($(el).text());
      if (!text.includes("Address:")) return;
      const blocks = parseLocationBlocks(text);
      if (blocks.length < 2) return;

      // Prefer blocks that have named cities (non-empty cityName)
      const namedCount = blocks.filter((b) => b.city && !/\d/.test(b.city)).length;
      const bestNamedCount = bestBlocks.filter((b) => b.city && !/\d/.test(b.city)).length;

      if (namedCount > bestNamedCount || (namedCount === bestNamedCount && blocks.length > bestBlocks.length)) {
        bestBlocks = blocks;
      }
    });

    if (bestBlocks.length >= 2) {
      const namedCount = bestBlocks.filter((b) => b.city && !/\d/.test(b.city)).length;
      const globalNamed = globalBest.filter((b) => b.city && !/\d/.test(b.city)).length;
      if (namedCount > globalNamed || globalBest.length === 0) {
        globalBest = bestBlocks;
      }
      // If we already have fully named blocks, stop early
      if (namedCount >= 2) break;
    }
  }

  if (globalBest.length < 2) return [];

  // ── Collect all maps links from the page and match to each location ──────────
  const mapsLinks = collectMapsLinks($);

  return globalBest
    .filter((b) => b.address || b.city)
    .map((b, blockIdx) => {
      const parsedAddr = b.address ? parseAddress(b.address) : { city: null, state: null, zip: null, street: null };
      // City: prefer named city-heading from scanner, fall back to parsed from address
      const resolvedCity = (b.city && !/\d/.test(b.city) ? b.city : null)
        ?? parsedAddr.city
        ?? null;

      // Match the best maps URL for this location
      const mapsUrl = pickMapsLink(mapsLinks, b.address ?? null, resolvedCity, blockIdx);

      return {
        name: resolvedCity ?? undefined,
        address: b.address ?? undefined,
        city: resolvedCity ?? undefined,
        state: b.state ?? parsedAddr.state ?? undefined,
        zip: b.zip ?? parsedAddr.zip ?? undefined,
        phone: b.phone ?? undefined,
        email: b.email ?? undefined,
        maps_url: mapsUrl ?? undefined,
      };
    });
}

/**
 * Pick the best maps link for a location given its address and city.
 *
 * Strategy:
 *   1. Find a link whose anchor text contains the street number from the address
 *   2. Find a link whose anchor text contains the city name
 *   3. Fall back to positional order (blockIdx-th link)
 *   4. Fall back to the first available link
 */
function pickMapsLink(
  links: MapsLink[],
  address: string | null,
  city: string | null,
  blockIdx: number,
): string | null {
  // Drop coordinate-only / broken maps URLs up front — never return those.
  const usable = links.filter((l) => sanitizeMapsUrl(l.href));
  if (usable.length === 0) return null;

  // Normalize helper
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  const streetNum = address?.match(/^\d+/)?.[0] ?? null;
  const normCity = city ? norm(city) : null;

  // Score each link: higher = better match. Link quality (short link / place URL)
  // dominates, then street-number, then city, then positional order.
  const scored = usable.map((lnk, i) => {
    const t = norm(lnk.text);
    let score = mapsUrlQuality(lnk.href) * 4;               // 0 / 4 / 12
    if (streetNum && t.includes(streetNum)) score += 10;   // street number match (very specific)
    if (normCity && t.includes(normCity)) score += 5;       // city name match
    if (i === blockIdx) score += 1;                          // positional bonus
    return { lnk, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.lnk.href ?? null;
}


// ─── Maps-link block extraction (Step 1 of spec) ─────────────────────────────
//
// For every Google Maps / short-URL link on the page:
//   1. Resolve the full address from aria-label, anchor text, or block text
//   2. Walk UP the DOM until we hit an ancestor that also contains a tel: link —
//      this finds the per-location container even in Elementor column layouts
//      where the phone widget is a sibling of the address widget
//   3. Extract phone + location name from that container
//   4. Deduplicate by normalised address prefix

const MAPS_LINK_SEL = [
  "a[href*='maps.app.goo.gl']",
  "a[href*='goo.gl/maps']",
  "a[href*='google.com/maps']",
  "a[href*='maps.google.com']",
].join(",");

const BLOCK_PHONE_RE = /\(?\d{3}\)?[.\-\s]?\d{3}[.\-\s]?\d{4}/;

// Broad address regex: street number + suffix word (includes Pike, Road, Blvd full form, etc.)
const BLOCK_ADDR_RE =
  /\d+[^,\n]{3,50}(?:Ave(?:nue)?|Blvd|Boulevard|Ct|Court|Cir(?:cle)?|Dr(?:ive)?|Hwy|Highway|Lane|Ln|Pike|Pkwy|Parkway|Pl(?:aza)?|Rd|Road|St(?:reet)?|Ste|Suite|Way|FM)\b[^,\n]{0,30}/i;

/**
 * Walk up from a maps link anchor to find the container element that also
 * holds a tel: link — i.e. the per-location card, even in Elementor column
 * layouts where the phone widget is a sibling of the address widget.
 * Falls back to the nearest li/div/section if no tel: link is found.
 */
function findLocationContainer(
  $: CheerioAPI,
  anchor: ReturnType<CheerioAPI>,
): ReturnType<CheerioAPI> {
  // We need a consistent type, so use closest() which always returns ReturnType<CheerioAPI>
  // Walk up manually by repeatedly calling .parent() as ReturnType<CheerioAPI>
  type CEl = ReturnType<CheerioAPI>;
  let el: CEl = anchor.parent() as CEl;
  for (let depth = 0; depth < 10; depth++) {
    if (!el.length) break;
    if (el.find("a[href^='tel:']").length > 0) return el;
    el = el.parent() as CEl;
  }
  return anchor.closest("li, div, section") as CEl;
}

/**
 * The address a maps link carries in its OWN aria-label / anchor text — the
 * highest-confidence per-location signal (Elementor footers link the full
 * address). Returns null when the link has no address of its own.
 */
function anchoredAddress(anchor: ReturnType<CheerioAPI>): string | null {
  // A full street address: starts with a house number, has a comma, and ENDS
  // with a zip. The trailing-zip requirement avoids treating a bare street whose
  // house number happens to be 5 digits ("13222 S Tree Sparrow Dr") as a
  // complete address.
  const looksLikeAddress = (s: string) =>
    /^\d/.test(s) && /,/.test(s) && /\b\d{5}(?:-\d{4})?\s*$/.test(s);
  const aria = (anchor.attr("aria-label") ?? "")
    .replace(/\s*[-–]\s*opens?\s+in\s+(a\s+)?new\s+tab\s*$/i, "")
    .trim();
  if (looksLikeAddress(aria)) return aria;
  const text = cleanText(anchor.text());
  if (looksLikeAddress(text)) return text;
  return null;
}

function extractFromMapsLinksBlocks($: CheerioAPI): ScrapedLocation[] {
  const anchors = $(MAPS_LINK_SEL).toArray().map((el) => $(el));

  // When a site links ≥2 of its own addresses (the common multi-location
  // footer), trust ONLY those address-bearing links and skip the rest — a maps
  // link without its own address is then almost certainly a stray embed /
  // template leftover (e.g. a different business's pin) whose surrounding text
  // would be mis-scavenged. With <2, keep the original behaviour (resolve every
  // link, scavenging the surrounding block when the link has no address).
  const anchoredOnly = anchors.filter((a) => anchoredAddress(a)).length >= 2;

  const locations: ScrapedLocation[] = [];
  const seen = new Set<string>();

  for (const anchor of anchors) {
    const href = (anchor.attr("href") ?? "").trim();
    if (!href) continue;

    // ── Resolve the full address ────────────────────────────────────────────
    let addrStr = anchoredAddress(anchor);
    if (!addrStr) {
      if (anchoredOnly) continue; // stray link — skip when we already have ≥2 real ones
      // Fall back to scanning the surrounding block for an address.
      const block = findLocationContainer($, anchor);
      const fullM = BLOCK_ADDR_RE.exec(block.length ? cleanText(block.text()) : "");
      if (fullM) addrStr = fullM[0].trim();
    }
    if (!addrStr) continue;

    // ── Deduplicate (street-number + state + last-4-of-zip) ─────────────────
    const parsed = parseAddress(addrStr);
    const streetNum = addrStr.match(/^\d+/)?.[0] ?? "";
    const normKey =
      (streetNum + (parsed.state ?? "") + (parsed.zip?.slice(-4) ?? "")) ||
      addrStr.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
    if (seen.has(normKey)) continue;
    seen.add(normKey);

    // Phone from the surrounding block (best-effort).
    const block = findLocationContainer($, anchor);
    const phoneM = BLOCK_PHONE_RE.exec(block.length ? cleanText(block.text()) : "");

    locations.push({
      // City is a cleaner per-location label than scraped headings, which tend
      // to grab unrelated section titles ("Working Hours", "Address").
      name: parsed.city ?? undefined,
      address: addrStr,
      city: parsed.city ?? undefined,
      state: parsed.state ?? undefined,
      zip: parsed.zip ?? undefined,
      phone: phoneM ? phoneM[0].trim() : undefined,
      maps_url: href,
    });
  }

  return locations;
}

// ─── Schema.org ────────────────────────────────────────────────────────────────

function extractFromSchema($: CheerioAPI): ScrapedLocation[] {
  const locations: ScrapedLocation[] = [];

  $( "script[type='application/ld+json']").each((_, el) => {
    try {
      const raw = $(el).html() ?? "";
      const data = JSON.parse(raw);

      // Collect all nodes with an address from @graph or top-level
      const allNodes: Record<string, unknown>[] = [];
      if (Array.isArray(data?.["@graph"])) {
        allNodes.push(...(data["@graph"] as Record<string, unknown>[]));
      }
      if (data && typeof data === "object") allNodes.push(data as Record<string, unknown>);

      // Filter to nodes that look like physical locations
      const locationTypes = ["localbusiness", "place", "healthandbeauty", "medicalclinic", "organization"];
      const nodes = allNodes.filter((node) => {
        const t = (node?.["@type"] ?? "");
        const types: string[] = Array.isArray(t) ? t : [String(t)];
        return types.some((s) => locationTypes.some((lt) => s.toLowerCase().includes(lt)));
      });

      for (const node of nodes) {
        const addr = node.address as Record<string, string> | string | undefined;
        let address: string | undefined;
        let city: string | undefined;
        let state: string | undefined;
        let zip: string | undefined;

        if (addr && typeof addr === "object") {
          address = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode]
            .filter(Boolean)
            .join(", ");
          city = addr.addressLocality;
          state = addr.addressRegion;
          zip = addr.postalCode;
        } else if (typeof addr === "string" && addr.length > 5) {
          address = addr;
        }

        // Extract lat/lng from geo
        let lat: number | undefined;
        let lng: number | undefined;
        const geo = node?.geo as Record<string, string> | undefined;
        if (geo?.latitude && geo?.longitude) {
          const latN = parseFloat(String(geo.latitude));
          const lngN = parseFloat(String(geo.longitude));
          if (!isNaN(latN) && !isNaN(lngN)) { lat = latN; lng = lngN; }
        }

        const phone =
          typeof node.telephone === "string" ? node.telephone : undefined;
        const name =
          typeof node.name === "string" ? node.name : undefined;
        // Many sites put a broken `/maps/search/?query=lat,lng,zoom` link in
        // hasMap — drop it so we fall back to a real on-page maps link.
        const mapsUrl =
          typeof node.hasMap === "string"
            ? (sanitizeMapsUrl(node.hasMap) ?? undefined)
            : undefined;

        // Parse hours from openingHoursSpecification
        let hours: Record<string, HoursEntry> | undefined;
        const specs = node.openingHoursSpecification;
        if (Array.isArray(specs)) {
          hours = {};
          for (const spec of specs as Record<string, unknown>[]) {
            const days: string[] = Array.isArray(spec.dayOfWeek)
              ? (spec.dayOfWeek as string[])
              : typeof spec.dayOfWeek === "string"
              ? [spec.dayOfWeek as string]
              : [];
            for (const day of days) {
              const key = day.replace(/https?:\/\/schema\.org\//i, "").toUpperCase();
              hours[key] = {
                open: typeof spec.opens === "string" ? spec.opens : null,
                close: typeof spec.closes === "string" ? spec.closes : null,
                is_open: !!(spec.opens && spec.closes),
              };
            }
          }
        }

        if (address || city || phone) {
          locations.push({ name, address, city, state, zip, lat, lng, phone, hours, maps_url: mapsUrl });
        }
      }
    } catch {
      // ignore malformed JSON-LD
    }
  });

  // Deduplicate by address
  const seen = new Set<string>();
  return locations.filter((loc) => {
    const key = (loc.address ?? loc.city ?? "").toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── DOM card patterns ─────────────────────────────────────────────────────────

const LOCATION_CARD_SELECTORS = [
  "[class*='location-card']",
  "[class*='location-item']",
  "[class*='location-block']",
  "[class*='location__item']",
  "[class*='locations-item']",
  "[class*='store-card']",
  "[class*='office-card']",
  "[class*='clinic-card']",
  "[class*='location-box']",
];

function extractFromCards($: CheerioAPI, html: string): ScrapedLocation[] {
  const locations: ScrapedLocation[] = [];

  for (const sel of LOCATION_CARD_SELECTORS) {
    const cards = $(sel);
    if (cards.length < 2) continue;

    cards.each((_, rawEl) => {
      const card = $(rawEl);
      const text = cleanText(card.text());

      // Must look like it has an address (contains digits + city-like pattern)
      if (!/\d{3,}/.test(text)) return;

      const phone = extractPhone(card as unknown as CheerioAPI, card.html() ?? "");
      const mapsLink = card.find("a[href*='maps.google'],a[href*='google.com/maps'],a[href*='goo.gl/maps']").first().attr("href");

      // Parse address from text directly
      const addrMatch = text.match(/\d+[^,\n]{3,50}(?:Ave|Blvd|Ct|Dr|Hwy|Lane|Ln|Rd|St|Ste|Suite|Way|FM)[^,\n]{0,30}/i);
      const addrStr = addrMatch ? addrMatch[0].trim() : null;
      const parsed = addrStr ? parseAddress(addrStr) : null;

      const name = cleanText(card.find("h2,h3,h4,[class*='title'],[class*='name']").first().text()) || undefined;

      if (addrStr || parsed?.city) {
        locations.push({
          name: name || undefined,
          address: addrStr ?? undefined,
          city: parsed?.city ?? undefined,
          state: parsed?.state ?? undefined,
          zip: parsed?.zip ?? undefined,
          phone: phone ?? undefined,
          maps_url: mapsLink ?? undefined,
          hours: extractHours(card as unknown as CheerioAPI, card.html() ?? "") ?? undefined,
        });
      }
    });

    if (locations.length >= 2) break;
  }

  return locations;
}

// ─── /locations page ──────────────────────────────────────────────────────────

async function extractFromLocationsPage(
  $home: CheerioAPI,
  baseUrl: string
): Promise<ScrapedLocation[]> {
  // Find a /locations link in nav
  let locationsUrl: string | null = null;
  $home("a[href]").each((_, el) => {
    if (locationsUrl) return;
    const href = $home(el).attr("href") ?? "";
    const text = ($home(el).text() ?? "").toLowerCase().trim();
    const abs = toAbsolute(href, baseUrl);
    if (!abs) return;
    try {
      if (new URL(abs).hostname !== new URL(baseUrl).hostname) return;
    } catch {
      return;
    }
    if (/\/(locations|our-locations|find-us|find-a-location)/.test(abs) || text === "locations") {
      locationsUrl = abs;
    }
  });

  if (!locationsUrl) return [];

  const result = await fetchHtml(locationsUrl);
  if (!result) return [];

  const $loc = load(result.html);

  // Try footer text first
  const fromFooter = extractFromFooterText($loc, result.html);
  if (fromFooter.length >= 2) return fromFooter;

  // Try schema
  const fromSchema = extractFromSchema($loc);
  if (fromSchema.length >= 2) return fromSchema;

  // Try cards
  const fromCards = extractFromCards($loc, result.html);
  if (fromCards.length >= 2) return fromCards;

  return [];
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Detect all physical locations for a website.
 * Returns an array with at least one entry (the main/merged contact).
 *
 * @param $home     Cheerio DOM of the homepage
 * @param html      Raw HTML of the homepage
 * @param baseUrl   The canonical base URL
 * @param mergedContact  The merged contact across home + contact + about pages
 * @param $contact  Optional Cheerio DOM of the contact page (higher fidelity for locations)
 * @param contactHtml   Optional raw HTML of the contact page
 */
export async function detectLocations(
  $home: CheerioAPI,
  html: string,
  baseUrl: string,
  mergedContact: ScrapeContact,
  $contact?: CheerioAPI,
  contactHtml?: string,
): Promise<ScrapedLocation[]> {
  // 0. Footer / body text blocks — HIGHEST PRIORITY (user preference)
  //    Try contact page first (richer data), then homepage
  if ($contact) {
    const fromContactFooter = extractFromFooterText($contact, contactHtml ?? "");
    if (fromContactFooter.length >= 2) {
      // Enrich with lat/lng from mergedContact (text blocks don't have geo)
      return fromContactFooter.map((loc) => ({
        ...loc,
        lat: loc.lat ?? mergedContact.lat ?? undefined,
        lng: loc.lng ?? mergedContact.lng ?? undefined,
        email: loc.email ?? mergedContact.email ?? undefined,
      }));
    }
  }

  const fromHomeFooter = extractFromFooterText($home, html);
  if (fromHomeFooter.length >= 2) {
    return fromHomeFooter.map((loc) => ({
      ...loc,
      lat: loc.lat ?? mergedContact.lat ?? undefined,
      lng: loc.lng ?? mergedContact.lng ?? undefined,
      email: loc.email ?? mergedContact.email ?? undefined,
    }));
  }

  // 0.5. Maps-link block detection — walks up from each Google Maps anchor to
  //      collect address + phone from the surrounding block. Catches sites that
  //      list locations with map links but without "Phone:/Address:" label patterns.
  const mapsBlockSource = $contact ?? $home;
  const fromMapsBlocks = extractFromMapsLinksBlocks(mapsBlockSource);
  if (fromMapsBlocks.length >= 2) {
    return fromMapsBlocks.map((loc) => ({
      ...loc,
      lat: loc.lat ?? mergedContact.lat ?? undefined,
      lng: loc.lng ?? mergedContact.lng ?? undefined,
      email: loc.email ?? mergedContact.email ?? undefined,
    }));
  }

  // 1. Schema.org (high fidelity geo data)
  const fromSchema = extractFromSchema($home);
  if (fromSchema.length >= 2) return fromSchema;

  // 2. DOM card patterns on the homepage
  const fromCards = extractFromCards($home, html);
  if (fromCards.length >= 2) return fromCards;

  // 3. Try a dedicated /locations page
  const fromPage = await extractFromLocationsPage($home, baseUrl);
  if (fromPage.length >= 2) return fromPage;

  // 4. Fallback: single location from merged contact
  //    Grab the first maps link available on the page to use as maps_url
  const pageMapsLinks = ($contact ? collectMapsLinks($contact) : null) ?? collectMapsLinks($home);
  const singleMapsUrl = pickMapsLink(
    pageMapsLinks,
    mergedContact.address ?? null,
    mergedContact.city ?? null,
    0,
  );

  const single: ScrapedLocation = {
    name: mergedContact.name,
    address: mergedContact.address,
    city: mergedContact.city,
    state: mergedContact.state,
    zip: mergedContact.zip,
    lat: mergedContact.lat,
    lng: mergedContact.lng,
    phone: mergedContact.phone,
    email: mergedContact.email,
    hours: mergedContact.hours,
    maps_url: singleMapsUrl ?? undefined,
  };
  return [single];
}
