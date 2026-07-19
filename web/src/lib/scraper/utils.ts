import * as cheerio from "cheerio";

// Legacy bot UA kept for callers that still import it. HTML fetches now use a
// realistic browser UA (below) because many clinic sites sit behind WAFs
// (Cloudflare, Sucuri, etc.) that 403 a self-identifying bot outright —
// silently costing us the whole page and everything on it.
export const USER_AGENT = "MedSpaMaps-Bot/1.0 (+https://medspamaps.com/bot)";
export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
export const FETCH_TIMEOUT_MS = 15_000;
/** Max attempts (1 initial + retries) for a transient failure. */
const FETCH_MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch HTML with browser-like headers, a timeout, and retry+backoff on
 * transient failures (network errors, 429, 5xx). A 4xx other than 429 is
 * treated as permanent and returns null immediately (no point retrying a 404).
 * `retry-after` is honored on 429/503. Returns null only after exhausting
 * retries so a single hiccup never silently drops a page.
 */
export async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string } | null> {
  let lastErr = "";
  for (let attempt = 1; attempt <= FETCH_MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: {
          "User-Agent": BROWSER_UA,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Upgrade-Insecure-Requests": "1",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
        },
        redirect: "follow",
      });
      if (res.ok) {
        const html = await res.text();
        return { html, finalUrl: res.url || url };
      }
      // Permanent client errors (404/401/403 that isn't rate-limit): don't retry.
      if (res.status !== 429 && res.status < 500) return null;
      lastErr = `HTTP ${res.status}`;
      // Honor Retry-After (seconds) on 429/503, else exponential backoff.
      const ra = Number(res.headers.get("retry-after"));
      const backoff = Number.isFinite(ra) && ra > 0
        ? Math.min(ra * 1000, 15_000)
        : Math.min(2 ** attempt * 500, 8_000);
      if (attempt < FETCH_MAX_ATTEMPTS) await sleep(backoff);
    } catch (err) {
      lastErr = err instanceof Error ? err.message : "fetch error";
      if (attempt < FETCH_MAX_ATTEMPTS) await sleep(Math.min(2 ** attempt * 500, 8_000));
    }
  }
  if (lastErr) console.warn(`[fetchHtml] gave up on ${url} after ${FETCH_MAX_ATTEMPTS} attempts: ${lastErr}`);
  return null;
}

/** Resolve a potentially relative URL against a base */
export function toAbsolute(src: string, base: string): string | null {
  if (!src || src.startsWith("data:") || src.startsWith("javascript:")) return null;
  try {
    return new URL(src, base).href;
  } catch {
    return null;
  }
}

/** Extract the base origin from a URL */
export function getBase(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return `${u.protocol}//${u.host}`;
  } catch {
    return url;
  }
}

/** Normalize a website URL to ensure it has a protocol */
export function normalizeUrl(url: string): string {
  if (!url.startsWith("http")) return `https://${url}`;
  return url;
}

/** Clean whitespace from extracted text */
export function cleanText(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

/** Slugify a string to match the SQL slugify function */
export function slugify(val: string): string {
  return val
    .toLowerCase()
    .replace(/[®™©°]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Parse a price string like "$199", "$150-$299", "from $99", "starting at $150"
 * Returns { from, to, notes, varies }
 */
export function parsePrice(raw: string): {
  from: number | null;
  to: number | null;
  notes: string | null;
  varies: boolean;
} {
  if (!raw) return { from: null, to: null, notes: null, varies: false };

  const lower = raw.toLowerCase().trim();

  if (
    lower.includes("vary") ||
    lower.includes("varies") ||
    lower.includes("consultation") ||
    lower.includes("call for")
  ) {
    return { from: null, to: null, notes: raw.trim(), varies: true };
  }

  // Extract all dollar amounts
  const amounts = [...raw.matchAll(/\$\s*([\d,]+(?:\.\d{1,2})?)/g)].map(
    (m) => parseFloat(m[1].replace(/,/g, ""))
  );

  if (amounts.length === 0) return { from: null, to: null, notes: null, varies: false };
  if (amounts.length === 1) {
    const notes = lower.includes("starting") || lower.includes("from") ? `from $${amounts[0]}` : null;
    return { from: amounts[0], to: null, notes, varies: false };
  }

  const [from, to] = [Math.min(...amounts), Math.max(...amounts)];
  return { from, to: from !== to ? to : null, notes: null, varies: false };
}

/** Parse duration string like "30 min", "1 hour", "45 minutes" → minutes */
export function parseDuration(raw: string): number | null {
  const lower = raw.toLowerCase();

  const hourMatch = lower.match(/(\d+)\s*(?:hr|hour)/);
  const minMatch = lower.match(/(\d+)\s*(?:min|minute)/);

  let total = 0;
  if (hourMatch) total += parseInt(hourMatch[1]) * 60;
  if (minMatch) total += parseInt(minMatch[1]);

  return total > 0 ? total : null;
}

/** Load HTML into Cheerio */
export function load(html: string): cheerio.CheerioAPI {
  return cheerio.load(html);
}

/** Check if a string looks like it contains a US state code */
export const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
  ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
};

/** Reverse of US_STATES: full state name (lowercased) → 2-letter code. */
const STATE_NAME_TO_ABBR: Record<string, string> = Object.fromEntries(
  Object.entries(US_STATES).map(([abbr, name]) => [name.toLowerCase(), abbr])
);
/** Matches a trailing ", <Full State Name> <ZIP>" so a full state name (e.g.
 * "Island Park, New York 11558") can be normalised to the 2-letter form the
 * rest of parseAddress keys on. Anchored to a comma + trailing zip, so a city
 * named like a state (", New York, NY 10001") is unaffected. */
const STATE_NAME_TAIL_RE = new RegExp(
  String.raw`,\s*(` + Object.values(US_STATES).join("|") + String.raw`)\s*,?\s+(\d{5}(?:-\d{4})?)\s*$`,
  "i"
);

/** Extract state abbreviation + city from an address string */
export function parseAddress(address: string): {
  city: string | null;
  state: string | null;
  zip: string | null;
  street: string | null;
} {
  // Strategy: anchor to the trailing "STATE ZIP" — allowing an optional comma
  // BEFORE the state (e.g. "Burleson TX, 76028") and/or before the zip
  // ("Cincinnati, OH, 45236"). The state+zip is the only reliable anchor.
  // Handles:
  //   "123 Main St, Dallas, TX 75201"
  //   "541 Buttermilk Pike, Suite 100 Crescent Springs, KY 41017"
  //   "5901 E Galbraith RD, Cincinnati, OH, 45236"     ← comma before zip
  //   "1314 NW John Jones Burleson TX, 76028"          ← no comma before state
  //   "12846 South Fwy 140 Suite 216, Burleson, TX 76028"
  // Normalise a trailing full state name ("…, New York 11558") to its 2-letter
  // code so the "<ST> <ZIP>" anchor below resolves the city/state correctly.
  address = address.replace(STATE_NAME_TAIL_RE, (_m, name: string, zip: string) => {
    const abbr = STATE_NAME_TO_ABBR[String(name).toLowerCase()];
    return abbr ? `, ${abbr} ${zip}` : _m;
  });

  const STREET_SUFFIX = /^(st|street|ave|avenue|rd|road|blvd|boulevard|fwy|freeway|hwy|highway|dr|drive|ln|lane|way|ct|court|pkwy|parkway|pike|pl|place|ste|suite|unit|apt|fl|floor|bldg|n|s|e|w|ne|nw|se|sw)$/i;
  const tailMatch = address.match(
    /\b([A-Z]{2})\b\s*,?\s+(\d{5})(?:-\d{4})?\s*$/
  );
  let state: string | null = null;
  let zip: string | null = null;
  let city: string | null = null;

  if (tailMatch && US_STATES[tailMatch[1]]) {
    state = tailMatch[1];
    zip = tailMatch[2];

    // Body is everything before the state token.
    const body = address.slice(0, tailMatch.index).replace(/[,\s]+$/, "");
    const lastComma = body.lastIndexOf(",");
    let rawCity: string;
    if (lastComma >= 0) {
      // City is the segment after the last comma ("..., Dallas" → "Dallas").
      rawCity = body.slice(lastComma + 1).trim();
    } else {
      // No comma before the state: the city is the trailing word(s)
      // ("1314 NW John Jones Burleson" → "Burleson").
      const tokens = body.split(/\s+/).filter(Boolean);
      rawCity = tokens[tokens.length - 1] ?? "";
    }
    // Strip a leading Suite/Apt/Unit/Floor that got merged into the segment.
    rawCity = rawCity
      .replace(/^(?:Suite|Ste\.?|Apt\.?|Unit|#|Bldg\.?|Fl(?:oor)?)\s+\S+\s*/i, "")
      .trim();
    // Reject if it's empty, has digits, or is just a street suffix/direction.
    if (rawCity && !/\d/.test(rawCity) && rawCity.length >= 2 && !STREET_SUFFIX.test(rawCity)) {
      city = rawCity;
    }
  } else {
    // Fallback for unusual formats. Take the LAST 5-digit group (never a
    // leading street number) as the zip.
    const zips = [...address.matchAll(/\b(\d{5})(?:-\d{4})?\b/g)];
    const lastZip = zips[zips.length - 1];
    zip = lastZip && (lastZip.index ?? 0) > 0 ? lastZip[1] : null;
    const stateMatch = address.match(/\b([A-Z]{2})\b/);
    state = stateMatch && US_STATES[stateMatch[1]] ? stateMatch[1] : null;
    const cityStateMatch = address.match(/([^,]+),\s*([A-Z]{2})\b/);
    if (cityStateMatch) {
      const cand = cityStateMatch[1].trim();
      if (!/\d/.test(cand) && !STREET_SUFFIX.test(cand)) city = cand;
    }
  }

  // Street = first comma-delimited segment
  const street = address.split(",")[0]?.trim() ?? null;

  return { city, state, zip, street };
}

/** Remove duplicates from an array of objects by a key getter */
export function dedupeBy<T>(arr: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return arr.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
