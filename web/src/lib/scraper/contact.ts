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

/** Extract address from footer, schema.org, or address tags */
export function extractAddress(
  $: CheerioAPI
): { address: string | null; city: string | null; state: string | null; zip: string | null } {
  // 1. Schema.org JSON-LD
  let found: string | null = null;
  $("script[type='application/ld+json']").each((_, el) => {
    if (found) return;
    try {
      const data = JSON.parse($(el).html() ?? "");
      const addr = data?.address ?? data?.location?.address;
      if (addr) {
        if (typeof addr === "string") {
          found = addr;
        } else if (addr.streetAddress) {
          const parts = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode]
            .filter(Boolean)
            .join(", ");
          found = parts;
        }
      }
    } catch {
      // ignore
    }
  });
  if (found) {
    const parsed = parseAddress(found);
    return { address: found, city: parsed.city, state: parsed.state, zip: parsed.zip };
  }

  // 2. <address> tags
  $("address").each((_, el) => {
    if (found) return;
    const text = cleanText($(el).text());
    if (text.length > 10) found = text;
  });
  if (found) {
    const parsed = parseAddress(found);
    return { address: found, city: parsed.city, state: parsed.state, zip: parsed.zip };
  }

  // 3. Elements with "address" in class/id
  $("[class*='address'],[id*='address'],[itemprop='address']").each((_, el) => {
    if (found) return;
    const text = cleanText($(el).text());
    if (text.length > 10 && /\d/.test(text)) found = text;
  });
  if (found) {
    const parsed = parseAddress(found);
    return { address: found, city: parsed.city, state: parsed.state, zip: parsed.zip };
  }

  return { address: null, city: null, state: null, zip: null };
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
  yelp_url: string | null;
  google_my_business: string | null;
} {
  let instagram: string | null = null;
  let facebook: string | null = null;
  let tiktok: string | null = null;
  let yelp: string | null = null;
  let gmb: string | null = null;

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    if (!instagram && href.includes("instagram.com/")) instagram = href;
    if (!facebook && href.includes("facebook.com/")) facebook = href;
    if (!tiktok && href.includes("tiktok.com/")) tiktok = href;
    if (!yelp && href.includes("yelp.com/biz/")) yelp = href;
    if (!gmb && (href.includes("google.com/maps") || href.includes("maps.google.com"))) gmb = href;
  });

  return {
    instagram_url: instagram,
    facebook_url: facebook,
    tiktok_url: tiktok,
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

  return {
    name: extractName($) ?? undefined,
    phone: extractPhone($, html) ?? undefined,
    email: extractEmail($, html) ?? undefined,
    address: addr.address ?? undefined,
    city: addr.city ?? undefined,
    state: addr.state ?? undefined,
    zip: addr.zip ?? undefined,
    about: extractAbout($) ?? undefined,
    booking_url: extractBookingUrl($) ?? undefined,
    hours: extractHours($, html) ?? undefined,
    instagram_url: socials.instagram_url ?? undefined,
    facebook_url: socials.facebook_url ?? undefined,
    tiktok_url: socials.tiktok_url ?? undefined,
    yelp_url: socials.yelp_url ?? undefined,
    google_my_business: socials.google_my_business ?? undefined,
  };
}
