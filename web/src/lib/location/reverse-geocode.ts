import { toStateCode, toStateName } from "./states";

export interface ReverseGeocodeResult {
  /** ISO 3166-1 alpha-2 country code, e.g. "US", "GB". Null if unknown. */
  countryCode: string | null;
  /** 2-letter USPS state code, e.g. "NV". Null when not a US state. */
  stateCode: string | null;
  /** Full state name, best-effort. */
  stateName: string | null;
  /** City / locality, best-effort. */
  city: string | null;
}

/**
 * Reverse-geocode a coordinate to country + US state using BigDataCloud's free,
 * key-less, CORS-enabled client endpoint. Throws on network/parse failure so the
 * caller can fall back gracefully (we still keep raw lat/lng for distance).
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult> {
  const url =
    `https://api.bigdatacloud.net/data/reverse-geocode-client` +
    `?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}` +
    `&localityLanguage=en`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`reverse-geocode failed: ${res.status}`);
  const data = await res.json();

  const countryCode: string | null = data?.countryCode ?? null;
  // principalSubdivisionCode is ISO ("US-NV"); principalSubdivision is the name.
  const stateCode =
    toStateCode(data?.principalSubdivisionCode) ??
    toStateCode(data?.principalSubdivision);

  return {
    countryCode,
    stateCode,
    stateName: toStateName(stateCode) ?? data?.principalSubdivision ?? null,
    city: data?.city || data?.locality || null,
  };
}
