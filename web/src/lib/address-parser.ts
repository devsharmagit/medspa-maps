/**
 * address-parser.ts
 *
 * Parses US address strings (typically from Google Maps format) to extract
 * city, state abbreviation, and zip code. Handles common patterns like:
 *   "5711 Hillcroft Ave Suite A-6, Houston, TX 77036, USA"
 *   "123 William St, New York, NY 10038"
 *   "3710 West Azeele Street Tampa, FL 33609"
 */

// ── State look-ups ──────────────────────────────────────────────────────────

/** 2-letter abbreviation → full state name */
export const STATE_ABBREVIATIONS: Record<string, string> = {
  AL: "Alabama",    AK: "Alaska",      AZ: "Arizona",       AR: "Arkansas",
  CA: "California", CO: "Colorado",    CT: "Connecticut",   DE: "Delaware",
  FL: "Florida",    GA: "Georgia",     HI: "Hawaii",        ID: "Idaho",
  IL: "Illinois",   IN: "Indiana",     IA: "Iowa",          KS: "Kansas",
  KY: "Kentucky",   LA: "Louisiana",   ME: "Maine",         MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",     MS: "Mississippi",
  MO: "Missouri",   MT: "Montana",    NE: "Nebraska",      NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",  NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio",     OK: "Oklahoma",
  OR: "Oregon",     PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas",         UT: "Utah",
  VT: "Vermont",    VA: "Virginia",    WA: "Washington",    WV: "West Virginia",
  WI: "Wisconsin",  WY: "Wyoming",     DC: "District of Columbia",
};

/** Full state name (lower-cased) → 2-letter abbreviation */
export const STATE_NAME_TO_ABBR: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_ABBREVIATIONS).map(([abbr, name]) => [name.toLowerCase(), abbr])
);

// ── Types ───────────────────────────────────────────────────────────────────

export interface ParsedAddress {
  city: string | null;
  state: string | null; // always a 2-letter abbreviation when present
  zip: string | null;
}

// ── Main parser ─────────────────────────────────────────────────────────────

/**
 * Extracts city, state (abbreviation), and zip from a US address string.
 * Returns `null` only when parsing fails entirely (gibberish / too short).
 */
export function parseUSAddress(address: string | null | undefined): ParsedAddress | null {
  if (!address || address.trim().length < 5) return null;

  const cleaned = address.trim();

  // ── Primary pattern: ", City, ST ZIP" ─────────────────────────────────
  // Most Google-formatted addresses follow this convention.
  const primaryMatch = cleaned.match(
    /,\s*([A-Za-z][A-Za-z\s.''-]{1,30}?)\s*,\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/
  );

  if (primaryMatch) {
    const [, rawCity, stateAbbr, zip] = primaryMatch;
    if (STATE_ABBREVIATIONS[stateAbbr]) {
      const city = rawCity.trim();
      // Reject city if it looks like a suite/unit indicator
      const validCity = city.length >= 2 && !/^(suite|ste|unit|apt|bldg|#)/i.test(city);
      return { city: validCity ? city : null, state: stateAbbr, zip };
    }
  }

  // ── Fallback pattern: "City, ST ZIP" (no leading comma before city) ────
  // Handles addresses like "3710 West Azeele Street Tampa, FL 33609"
  // Strategy: look for the "..., ST ZIP" anchor, then work backwards to find city
  const fallbackMatch = cleaned.match(
    /,\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/
  );

  if (fallbackMatch && fallbackMatch.index != null) {
    const [, stateAbbr, zip] = fallbackMatch;
    if (STATE_ABBREVIATIONS[stateAbbr]) {
      // Extract potential city: text between previous comma and the match
      const beforeState = cleaned.slice(0, fallbackMatch.index);
      const lastCommaIdx = beforeState.lastIndexOf(",");
      const cityCandidate = (lastCommaIdx >= 0
        ? beforeState.slice(lastCommaIdx + 1)
        : beforeState
      ).trim();

      // Validate: must look like a real city name (not a suite/unit/number prefix)
      const validCity =
        cityCandidate.length >= 2 &&
        /^[A-Z]/.test(cityCandidate) &&
        !/^(suite|ste|unit|apt|bldg|#|\d)/i.test(cityCandidate);

      return { city: validCity ? cityCandidate : null, state: stateAbbr, zip };
    }
  }

  // ── Minimal pattern: just "ST ZIP" ────────────────────────────────────
  const stateZipMatch = cleaned.match(/\b([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\b/);
  if (stateZipMatch) {
    const [, stateAbbr, zip] = stateZipMatch;
    if (STATE_ABBREVIATIONS[stateAbbr]) {
      return { city: null, state: stateAbbr, zip };
    }
  }

  return null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalizes a state value to its 2-letter abbreviation.
 * Accepts full names ("Texas"), abbreviations ("TX"), or mixed case.
 * Returns `null` when the input is not a recognized US state.
 */
export function normalizeState(state: string | null | undefined): string | null {
  if (!state) return null;
  const trimmed = state.trim();
  if (trimmed.length === 0) return null;

  // Already a valid abbreviation?
  const upper = trimmed.toUpperCase();
  if (STATE_ABBREVIATIONS[upper]) return upper;

  // Full name?
  const abbr = STATE_NAME_TO_ABBR[trimmed.toLowerCase()];
  return abbr ?? null;
}

/**
 * Normalizes a state value to its FULL NAME ("Texas").
 * Accepts abbreviations ("TX"), full names ("texas"), or mixed case.
 * When the input is a recognized US state it returns the canonical full name;
 * otherwise it returns the trimmed input (or null when empty).
 */
export function stateFullName(state: string | null | undefined): string | null {
  if (!state) return null;
  const trimmed = state.trim();
  if (trimmed.length === 0) return null;
  const abbr = normalizeState(trimmed);
  return abbr ? STATE_ABBREVIATIONS[abbr] : trimmed;
}
