import type { CheerioAPI } from "cheerio";
import type { ScrapeContact, HoursEntry } from "./types";
import { cleanText, parseAddress } from "./utils";

const BOOKING_PLATFORMS = [
  "vagaro.com",
  "mindbodyonline.com",
  "booker.com",
  "acuityscheduling.com",
  "janeapp.com",
  "boulevard.com",
  "zenoti.com",
  "fresha.com",
  "squareup.com/appointments",
  "square.com/appointments",
  "schedulicity.com",
  "gloss-genius.com",
  "glossgenius.com",
  "patientpop.com",
  "healthgrades.com",
  "zocdoc.com",
];

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_ABBR: Record<string, string> = {
  mon: "MONDAY", tue: "TUESDAY", wed: "WEDNESDAY", thu: "THURSDAY",
  fri: "FRIDAY", sat: "SATURDAY", sun: "SUNDAY",
  monday: "MONDAY", tuesday: "TUESDAY", wednesday: "WEDNESDAY",
  thursday: "THURSDAY", friday: "FRIDAY", saturday: "SATURDAY", sunday: "SUNDAY",
};

/** Extract phone number */
export function extractPhone($: CheerioAPI, html: string): string | null {
  // 1. tel: links
  let phone: string | null = null;
  $("a[href^='tel:']").each((_, el) => {
    if (phone) return;
    const raw = $( el).attr("href")!.replace("tel:", "").replace(/\s/g, "");
    if (raw.replace(/\D/g, "").length >= 10) phone = raw;
  });
  if (phone) return phone;

  // 2. Regex in HTML — common US phone patterns
  const m = html.match(/(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/);
  return m ? m[0].trim() : null;
}

/** Extract email */
export function extractEmail($: CheerioAPI, html: string): string | null {
  let email: string | null = null;
  $("a[href^='mailto:']").each((_, el) => {
    if (email) return;
    const raw = $(el).attr("href")!.replace("mailto:", "").split("?")[0].trim();
    if (raw.includes("@")) email = raw;
  });
  if (email) return email;

  const m = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : null;
}

// ─── Google Maps URL parser ────────────────────────────────────────────────────
// Extracts address + lat/lng from any Google Maps link found in the page.
// Handles all known URL formats:
//   /maps/place/{address}/@lat,lng,zoom/
//   /maps?ll=lat,lng&q={address}
//   /maps/search/?api=1&query=lat,lng
//   maps.google.com/?q={address}@lat,lng

interface MapsData {
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  street: string | null;
  lat: number | null;
  lng: number | null;
}

function parseMapsUrl(href: string): MapsData | null {
  let lat: number | null = null;
  let lng: number | null = null;
  let rawAddress: string | null = null;

  try {
    const url = new URL(href);

    // ── Pattern 1: /maps/place/{address-text}/@lat,lng ────────────────────────
    const placeMatch = url.pathname.match(/\/maps\/place\/([^/]+)\/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (placeMatch) {
      rawAddress = decodeURIComponent(placeMatch[1]).replace(/\+/g, " ").trim();
      lat = parseFloat(placeMatch[2]);
      lng = parseFloat(placeMatch[3]);
    }

    // ── Pattern 2: @lat,lng in path (without place prefix) ────────────────────
    if (lat === null) {
      const atMatch = url.pathname.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (atMatch) {
        lat = parseFloat(atMatch[1]);
        lng = parseFloat(atMatch[2]);
      }
    }

    // ── Pattern 3: ll=lat,lng query param ─────────────────────────────────────
    if (lat === null) {
      const ll = url.searchParams.get("ll");
      if (ll) {
        const parts = ll.split(",");
        if (parts.length === 2) { lat = parseFloat(parts[0]); lng = parseFloat(parts[1]); }
      }
    }

    // ── Address from ?q= param ────────────────────────────────────────────────
    if (!rawAddress) {
      const q = url.searchParams.get("q") ?? url.searchParams.get("query");
      if (q && !/^-?\d+\.\d+,-?\d+\.\d+$/.test(q.trim())) {
        rawAddress = decodeURIComponent(q).replace(/\+/g, " ").trim();
      }
    }
  } catch {
    return null;
  }

  // Must have at least one useful piece of data
  if (!rawAddress && lat === null) return null;

  // Reject if the "address" looks like a business name — require a street suffix word
  // AND a leading house number. "88 Aesthetic & Wellness" starts with a number but has no suffix.
  const STREET_SUFFIXES = /\b(?:Ave|Blvd|Ct|Cir|Dr|Hwy|Lane|Ln|Pkwy|Pl|Rd|Rte|St|Ste|Suite|Ter|Way|FM|Fwy|Expy|Loop|Pass)\b/i;
  const isLikelyStreetAddress = rawAddress
    ? /^\d+\s/.test(rawAddress.trim()) && STREET_SUFFIXES.test(rawAddress)
    : false;
  const cleanAddress = isLikelyStreetAddress
    ? rawAddress!.replace(/\s+USA\s*$/i, "").replace(/\s+US\s*$/i, "").trim()
    : null;

  // Parse structured address from the raw text (only if it's a real street address)
  const parsed = cleanAddress ? parseAddress(cleanAddress) : { city: null, state: null, zip: null, street: null };

  return {
    address: cleanAddress,
    city: parsed.city,
    state: parsed.state,
    zip: parsed.zip,
    street: parsed.street,
    lat: lat !== null && !isNaN(lat) ? lat : null,
    lng: lng !== null && !isNaN(lng) ? lng : null,
  };
}

/** Scan all <a href> tags for Google Maps links and return the best result */
function extractFromGoogleMaps($: CheerioAPI): MapsData | null {
  let best: MapsData | null = null;

  $("a[href*='maps.google'],a[href*='google.com/maps']").each((_, el) => {
    if (best !== null && best.lat !== null) return; // already have full coords, stop
    const href = $(el).attr("href") ?? "";
    if (!href) return;
    const data = parseMapsUrl(href);
    if (!data) return;
    // Prefer entries that have both address AND coords
    if (best === null || (data.lat !== null && best.lat === null)) {
      best = data;
    } else if (data.address && !best.address) {
      best = data;
    }
  });

  return best;
}

/** One maps link entry — href + the anchor text (useful for address-matching) */
export interface MapsLink {
  href: string;
  text: string;
}

/**
 * Collect every Google Maps / Apple Maps link on the page with its anchor text.
 * Covers full URLs (google.com/maps) and short links (maps.app.goo.gl, goo.gl/maps).
 * De-duped by href.
 */
export function collectMapsLinks($: CheerioAPI): MapsLink[] {
  const seen = new Set<string>();
  const links: MapsLink[] = [];

  const SEL = [
    "a[href*='maps.app.goo.gl']",
    "a[href*='goo.gl/maps']",
    "a[href*='google.com/maps']",
    "a[href*='maps.google.com']",
    "a[href*='apple.com/maps']",
  ].join(",");

  $(SEL).each((_, el) => {
    const href = ($(el).attr("href") ?? "").trim();
    if (!href || seen.has(href)) return;
    seen.add(href);
    const text = ($(el).text() ?? "").replace(/\s+/g, " ").trim();
    links.push({ href, text });
  });

  return links;
}

/** Extract address from footer, schema.org, or address tags */
export function extractAddress(
  $: CheerioAPI
): { address: string | null; city: string | null; state: string | null; zip: string | null; street: string | null } {
  // 0. Google Maps links — highest priority (contains structured address from Google)
  const maps = extractFromGoogleMaps($);
  if (maps?.address) {
    return {
      address: maps.address,
      city: maps.city,
      state: maps.state,
      zip: maps.zip,
      street: maps.street,
    };
  }

  // 1. Schema.org JSON-LD — search ALL nodes in @graph, not just top-level
  let found: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
  } | string | null = null;

  $("script[type='application/ld+json']").each((_, el) => {
    if (found) return;
    try {
      const data = JSON.parse($(el).html() ?? "");
      const nodes: Record<string, unknown>[] = [];
      if (Array.isArray(data?.["@graph"])) {
        nodes.push(...(data["@graph"] as Record<string, unknown>[]));
      }
      if (data && typeof data === "object") nodes.push(data as Record<string, unknown>);

      for (const node of nodes) {
        if (found) break;
        const nodeAny = node as Record<string, unknown>;
        const locationAny = nodeAny?.location as Record<string, unknown> | undefined;
        const addr = (nodeAny?.address ?? locationAny?.address) as Record<string, string> | string | undefined;
        if (!addr) continue;
        if (typeof addr === "string" && addr.length > 5) {
          found = addr;
        } else if (typeof addr === "object" && (addr.streetAddress || addr.addressLocality)) {
          found = addr;
        }
      }
    } catch { /* ignore */ }
  });

  if (found) {
    if (typeof found === "string") {
      const parsed = parseAddress(found);
      return { address: found, city: parsed.city, state: parsed.state, zip: parsed.zip, street: parsed.street };
    } else {
      const addrObj = found as { streetAddress?: string; addressLocality?: string; addressRegion?: string; postalCode?: string };
      const parts = [addrObj.streetAddress, addrObj.addressLocality, addrObj.addressRegion, addrObj.postalCode]
        .filter(Boolean).join(", ");
      return {
        address: parts || null,
        city: addrObj.addressLocality ?? null,
        state: addrObj.addressRegion ?? null,
        zip: addrObj.postalCode ?? null,
        street: addrObj.streetAddress ?? null,
      };
    }
  }

  // 2. <address> tags
  $("address").each((_, el) => {
    if (found) return;
    const text = cleanText($(el).text());
    if (text.length > 10) found = text;
  });
  if (found && typeof found === "string") {
    const parsed = parseAddress(found);
    return { address: found, city: parsed.city, state: parsed.state, zip: parsed.zip, street: parsed.street };
  }

  // 3. Elements with "address" in class/id
  $("[class*='address'],[id*='address'],[itemprop='address']").each((_, el) => {
    if (found) return;
    const text = cleanText($(el).text());
    if (text.length > 10 && /\d/.test(text)) found = text;
  });
  if (found && typeof found === "string") {
    const parsed = parseAddress(found);
    return { address: found, city: parsed.city, state: parsed.state, zip: parsed.zip, street: parsed.street };
  }

  // 4. Footer text — look for a US street address pattern
  const footerText = cleanText($("footer,[class*='footer']").text());
  const streetMatch = footerText.match(/\d+[^,\n]{3,40}(?:Ave|Blvd|Ct|Dr|Hwy|Lane|Ln|Rd|St|Way|FM|Suite|Ste)[^,\n]{0,30}/);
  if (streetMatch) {
    const addrStr = streetMatch[0].trim();
    const parsed = parseAddress(footerText);
    return { address: addrStr, city: parsed.city, state: parsed.state, zip: parsed.zip, street: addrStr };
  }

  return { address: null, city: null, state: null, zip: null, street: null };
}

/** Extract lat/lng — from schema.org geo, then Google Maps links */
export function extractLatLng($: CheerioAPI): { lat: number | null; lng: number | null } {
  // 1. Schema.org JSON-LD geo coordinates
  let lat: number | null = null;
  let lng: number | null = null;

  $("script[type='application/ld+json']").each((_, el) => {
    if (lat !== null) return;
    try {
      const data = JSON.parse($(el).html() ?? "");
      const nodes: Record<string, unknown>[] = Array.isArray(data?.["@graph"])
        ? [...(data["@graph"] as Record<string, unknown>[]), data as Record<string, unknown>]
        : [data as Record<string, unknown>];

      for (const node of nodes) {
        if (lat !== null) break;
        const geo = node?.geo as Record<string, string> | undefined;
        if (geo?.latitude && geo?.longitude) {
          lat = parseFloat(String(geo.latitude));
          lng = parseFloat(String(geo.longitude));
        }
      }
    } catch { /* ignore */ }
  });

  if (lat !== null && !isNaN(lat)) return { lat, lng };

  // 2. Google Maps links (handles sites with no schema.org geo)
  const mapsData = extractFromGoogleMaps($);
  if (mapsData && mapsData.lat !== null) {
    return { lat: mapsData.lat, lng: mapsData.lng };
  }

  return { lat: null, lng: null };
}

/** Extract about text from meta description or hero section */
export function extractAbout($: CheerioAPI): string | null {
  // 1. Meta description (reliable baseline)
  const meta = $("meta[name='description']").attr("content");
  if (meta && meta.length > 20) return cleanText(meta);

  // 2. First meaningful paragraph in about/hero sections
  const selectors = [
    "[class*='about'] p",
    "[class*='hero'] p",
    "[class*='intro'] p",
    "main > section p",
  ];
  for (const sel of selectors) {
    const text = cleanText($(sel).first().text());
    if (text.length > 50) return text;
  }

  return null;
}

/** Extract booking URL */
export function extractBookingUrl($: CheerioAPI): string | null {
  let bookingUrl: string | null = null;

  $("a[href]").each((_, el) => {
    if (bookingUrl) return;
    const href = $(el).attr("href") ?? "";
    for (const platform of BOOKING_PLATFORMS) {
      if (href.includes(platform)) {
        bookingUrl = href;
        return;
      }
    }
    // Button text patterns
    const text = $(el).text().toLowerCase().trim();
    if (
      (text.includes("book") || text.includes("schedule") || text.includes("appointment")) &&
      href.startsWith("http") &&
      !href.includes(new URL(href).hostname === "" ? "" : "")
    ) {
      // Only use external booking links (not internal /book pages)
      try {
        // We'll catch the booking URL from link text that points externally
        bookingUrl = href;
      } catch {
        // ignore
      }
    }
  });

  return bookingUrl;
}

/** Extract social media URLs */
export function extractSocials($: CheerioAPI): {
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
  linkedin_url: string | null;
  x_url: string | null;
  yelp_url: string | null;
  google_my_business: string | null;
} {
  let instagram: string | null = null;
  let facebook: string | null = null;
  let tiktok: string | null = null;
  let youtube: string | null = null;
  let linkedin: string | null = null;
  let xTwitter: string | null = null;
  let yelp: string | null = null;
  let gmb: string | null = null;

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (!instagram && href.includes("instagram.com/")) instagram = href;
    if (!facebook && href.includes("facebook.com/")) facebook = href;
    if (!tiktok && href.includes("tiktok.com/")) tiktok = href;
    if (!youtube && (href.includes("youtube.com/") || href.includes("youtu.be/"))) youtube = href;
    if (!linkedin && href.includes("linkedin.com/")) linkedin = href;
    if (!xTwitter && (href.includes("twitter.com/") || href.includes("x.com/"))) xTwitter = href;
    if (!yelp && href.includes("yelp.com/biz/")) yelp = href;
    if (!gmb && (href.includes("google.com/maps") || href.includes("maps.google.com"))) gmb = href;
  });

  return {
    instagram_url: instagram,
    facebook_url: facebook,
    tiktok_url: tiktok,
    youtube_url: youtube,
    linkedin_url: linkedin,
    x_url: xTwitter,
    yelp_url: yelp,
    google_my_business: gmb,
  };
}

/** Extract business name from page title / og:site_name */
export function extractName($: CheerioAPI): string | null {
  const og = $("meta[property='og:site_name']").attr("content");
  if (og) return cleanText(og);

  const title = cleanText($("title").text());
  if (!title) return null;

  // "Glow Medspa | Dallas, TX" → "Glow Medspa"
  const parts = title.split(/[|\-–—]/);
  if (parts.length > 1) return cleanText(parts[0]);

  return title.length < 60 ? title : null;
}

/** Extract business hours */
export function extractHours($: CheerioAPI, html: string): Record<string, HoursEntry> | null {
  const hours: Record<string, HoursEntry> = {};

  // 1. Schema.org JSON-LD openingHoursSpecification
  $("script[type='application/ld+json']").each((_, el) => {
    try {
      const data = JSON.parse($(el).html() ?? "");
      const specs =
        data?.openingHoursSpecification ??
        data?.["@graph"]?.find((n: { "@type"?: string }) => n["@type"] === "LocalBusiness")
          ?.openingHoursSpecification;

      if (Array.isArray(specs)) {
        for (const spec of specs) {
          const dayOfWeek: string[] = Array.isArray(spec.dayOfWeek)
            ? spec.dayOfWeek
            : [spec.dayOfWeek];
          for (const day of dayOfWeek) {
            const key = day.replace(/https?:\/\/schema\.org\//i, "").toUpperCase();
            hours[key] = {
              open: spec.opens ?? null,
              close: spec.closes ?? null,
              is_open: !!(spec.opens && spec.closes),
            };
          }
        }
      }
    } catch {
      // ignore
    }
  });

  if (Object.keys(hours).length > 0) return hours;

  // 2. Parse text patterns from hours sections
  const hoursText = extractHoursText($, html);
  if (hoursText) return hoursText;

  return null;
}

function extractHoursText($: CheerioAPI, html: string): Record<string, HoursEntry> | null {
  const hours: Record<string, HoursEntry> = {};

  // Find elements that likely contain hours
  const candidates: string[] = [];

  $("[class*='hour'],[class*='schedule'],[id*='hour'],[id*='schedule']").each((_, el) => {
    candidates.push($(el).text());
  });

  // Also check footer and contact sections
  $("footer,[class*='footer'],[class*='contact']").each((_, el) => {
    candidates.push($(el).text());
  });

  if (candidates.length === 0) {
    candidates.push(html);
  }

  const timeRx = /(\d{1,2}(?::\d{2})?)\s*(am|pm)/gi;
  const rangeRx = /(\d{1,2}(?::\d{2})?)\s*(am|pm)?\s*[-–—to]+\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)/gi;

  for (const text of candidates) {
    const lines = text.split(/[\n\r|•·]+/);
    for (const line of lines) {
      const lower = line.toLowerCase();
      const day = DAYS.find((d) => lower.includes(d));
      if (!day) continue;

      const rangeMatch = [...line.matchAll(rangeRx)][0];
      if (rangeMatch) {
        const openStr = normalizeTime(`${rangeMatch[1]} ${rangeMatch[2] || rangeMatch[4]}`);
        const closeStr = normalizeTime(`${rangeMatch[3]} ${rangeMatch[4]}`);
        const key = DAY_ABBR[day];
        if (key && !hours[key]) {
          hours[key] = { open: openStr, close: closeStr, is_open: true };
        }
        continue;
      }

      if (lower.includes("closed") || lower.includes("by appt")) {
        const key = DAY_ABBR[day];
        if (key && !hours[key]) {
          hours[key] = { open: null, close: null, is_open: false };
        }
      }
    }
  }

  return Object.keys(hours).length > 2 ? hours : null;
}

function normalizeTime(raw: string): string {
  const m = raw.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (!m) return raw.trim();
  let h = parseInt(m[1]);
  const min = m[2] ?? "00";
  const meridiem = m[3].toLowerCase();
  if (meridiem === "pm" && h !== 12) h += 12;
  if (meridiem === "am" && h === 12) h = 0;
  return `${h.toString().padStart(2, "0")}:${min}`;
}

/** Combine all contact extractors */
export function extractContact($: CheerioAPI, html: string): ScrapeContact {
  const addr = extractAddress($);
  const socials = extractSocials($);
  const geo = extractLatLng($);

  return {
    name: extractName($) ?? undefined,
    phone: extractPhone($, html) ?? undefined,
    email: extractEmail($, html) ?? undefined,
    address: addr.address ?? undefined,
    city: addr.city ?? undefined,
    state: addr.state ?? undefined,
    zip: addr.zip ?? undefined,
    lat: geo.lat ?? undefined,
    lng: geo.lng ?? undefined,
    about: extractAbout($) ?? undefined,
    booking_url: extractBookingUrl($) ?? undefined,
    hours: extractHours($, html) ?? undefined,
    instagram_url: socials.instagram_url ?? undefined,
    facebook_url: socials.facebook_url ?? undefined,
    tiktok_url: socials.tiktok_url ?? undefined,
    youtube_url: socials.youtube_url ?? undefined,
    linkedin_url: socials.linkedin_url ?? undefined,
    x_url: socials.x_url ?? undefined,
    yelp_url: socials.yelp_url ?? undefined,
    google_my_business: socials.google_my_business ?? undefined,
  };
}

