import * as cheerio from "cheerio";

export const USER_AGENT = "MedSpaMaps-Bot/1.0 (+https://medspamaps.com/bot)";
export const FETCH_TIMEOUT_MS = 15_000;

/** Fetch HTML from a URL with timeout and error handling */
export async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    return { html, finalUrl: res.url || url };
  } catch {
    return null;
  }
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

/** Extract state abbreviation + city from an address string */
export function parseAddress(address: string): {
  city: string | null;
  state: string | null;
  zip: string | null;
  street: string | null;
} {
  // Strategy: anchor to the trailing "STATE[,] ZIP" to extract city, state, zip reliably.
  // Handles all common formats:
  //   "123 Main St, Dallas, TX 75201"
  //   "123 Main St, Suite 100, Dallas, TX 75201"
  //   "541 Buttermilk Pike, Suite 100 Crescent Springs, KY 41017"
  //   "5901 E Galbraith RD, Cincinnati, OH, 45236"   ← comma before zip
  const tailMatch = address.match(/,\s*([A-Z]{2})[,\s]+(\d{5})(?:-\d{4})?\s*$/);
  let state: string | null = null;
  let zip: string | null = null;
  let city: string | null = null;

  if (tailMatch && US_STATES[tailMatch[1]]) {
    state = tailMatch[1];
    zip = tailMatch[2];

    // City = last comma-delimited segment before ", STATE ZIP"
    const body = address.slice(0, tailMatch.index).trimEnd();
    const segs = body.split(",");
    let rawCity = (segs[segs.length - 1] ?? "").trim();

    // Strip leading Suite/Apt/Unit/Floor/Building number that got merged into the city segment
    // e.g. "Suite 100 Crescent Springs" → "Crescent Springs"
    rawCity = rawCity.replace(
      /^(?:Suite|Ste\.?|Apt\.?|Unit|#|Bldg\.?|Fl(?:oor)?)\s+\S+\s*/i,
      ""
    ).trim();

    city = rawCity || null;
  } else {
    // Fallback: original heuristic for unusual formats
    const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
    zip = zipMatch ? zipMatch[1] : null;
    const stateMatch = address.match(/\b([A-Z]{2})\b/);
    state = stateMatch && US_STATES[stateMatch[1]] ? stateMatch[1] : null;
    const cityStateMatch = address.match(/([^,]+),\s*([A-Z]{2})\s*\d{0,5}/);
    if (cityStateMatch) city = cityStateMatch[1].trim();
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
