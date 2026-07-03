// Canonical US state code ⇄ name utilities, resilient to the dirty values that
// live in the DB ("Nevada", "NV", "US-NV", " utah ", etc.). We normalize
// everything to a 2-letter USPS code so geolocation, prefill and filtering line
// up without touching the stored data.

export const STATE_CODE_TO_NAME: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

const NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_CODE_TO_NAME).map(([code, name]) => [name.toLowerCase(), code]),
);

/**
 * Normalize any state-ish string to a 2-letter USPS code, or null if it can't
 * be resolved to a US state. Accepts codes ("NV"), names ("Nevada"), and ISO
 * subdivision codes ("US-NV").
 */
export function toStateCode(input?: string | null): string | null {
  if (!input) return null;
  let s = String(input).trim();
  if (!s) return null;

  // ISO 3166-2 form, e.g. "US-NV"
  const iso = s.match(/^US-([A-Za-z]{2})$/i);
  if (iso) s = iso[1];

  const upper = s.toUpperCase();
  if (STATE_CODE_TO_NAME[upper]) return upper;

  const byName = NAME_TO_CODE[s.toLowerCase()];
  return byName ?? null;
}

/** Full state name for a code (accepts dirty input via toStateCode). */
export function toStateName(input?: string | null): string | null {
  const code = toStateCode(input);
  return code ? STATE_CODE_TO_NAME[code] : null;
}
