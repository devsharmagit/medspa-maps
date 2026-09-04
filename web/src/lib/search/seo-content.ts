/**
 * search/seo-content.ts — evergreen, templated SEO copy for the /search page.
 *
 * The /search body is rendered by a client component, so a crawler/AI bot sees
 * almost no prose. This builds a short (~100-word) server-rendered paragraph
 * whose evergreen wording is fixed and only the *facts* (clinic count,
 * treatment/condition, location, popular treatments) are interpolated — so it
 * reads like real editorial copy, never auto-generated spam.
 *
 * Rules (mirrors the /locations/[state] pattern): NO pricing, sentence case,
 * the brand is exactly "Medspa Maps", and the generic term "med spas" stays
 * lowercase. Treatment/condition names are kept in their catalog casing (proper
 * names), matching how the state pages render them.
 *
 * Pure — no DB. All inputs are already resolved by the caller (page.tsx).
 */

export interface SearchSeoInput {
  /** Resolved treatment display name (e.g. "Botox"), or null. */
  treatmentName: string | null;
  /** Resolved concern/condition display name (e.g. "Dark Spots & Melasma"), or null. */
  conditionName: string | null;
  /** Full state name, the raw location string, or null when no location. */
  locationLabel: string | null;
  /** Full match count. 0 when there are no results or the count is unknown. */
  total: number;
  /** Popular treatment display names among the results, searched one excluded. */
  popularTreatments: string[];
}

export interface SearchSeoContent {
  /** Sentence-case heading (rendered as an <h2>). */
  heading: string;
  /**
   * A substring of `heading` to render in the brand's Fraunces italic accent
   * (the treatment / condition / location term). Always present in `heading`.
   */
  accent: string;
  /** One or more paragraphs, ~100 words total. */
  paragraphs: string[];
}

const BRAND = "Medspa Maps";

/** Oxford-comma join: ["a","b","c"] → "a, b, and c". (Mirrors the state page.) */
function listPhrase(items: string[]): string {
  const a = items.filter(Boolean);
  if (a.length === 0) return "";
  if (a.length === 1) return a[0];
  if (a.length === 2) return `${a[0]} and ${a[1]}`;
  return `${a.slice(0, -1).join(", ")}, and ${a[a.length - 1]}`;
}

/** "214 vetted med spas" / "1 vetted med spa". */
function countPhrase(total: number): string {
  return `${total.toLocaleString("en-US")} vetted med spa${total === 1 ? "" : "s"}`;
}

// Shared closing sentence — the value proposition, evergreen and pricing-free.
const VETTED_SENTENCE =
  "Every practice is editorially reviewed, with genuine patient reviews and the treatments it actually offers.";
// Shared compare/booking clause.
const COMPARE = "Compare them by patient rating, treatments offered, and location, then book directly.";

/**
 * Build the SEO content for the current query. Returns null only when there is
 * genuinely nothing to render (never happens today — the no-facet case still
 * returns a generic evergreen paragraph).
 */
export function buildSearchSeoContent(
  input: SearchSeoInput,
): SearchSeoContent | null {
  const { treatmentName, conditionName, locationLabel, total } = input;
  const hasCount = total > 0;
  // A bare ZIP is a radius search, so results are "in and near" it, not strictly
  // "in" it. A state/city name stays a plain "in".
  const isZip = !!locationLabel && /^\d{5}$/.test(locationLabel.trim());
  const locPrep = isZip ? "in and near" : "in";
  const inLoc = locationLabel ? ` ${locPrep} ${locationLabel}` : "";
  const popular = input.popularTreatments.filter(Boolean).slice(0, 3);

  // ── Treatment search (with or without a location) ─────────────────────────
  if (treatmentName) {
    const subject = `${treatmentName}${inLoc}`;
    const heading = hasCount
      ? `${countPhrase(total)} offering ${subject}`
      : `${treatmentName} providers${inLoc}`;
    const lead = hasCount
      ? `${BRAND} lists ${countPhrase(total)} offering ${subject}. ${COMPARE}`
      : `Explore med spas offering ${subject} on ${BRAND}. ${COMPARE}`;
    const popularSentence = popular.length
      ? ` Many also offer ${listPhrase(popular)}.`
      : "";
    return {
      heading,
      accent: treatmentName,
      paragraphs: [`${lead}${popularSentence} ${VETTED_SENTENCE}`],
    };
  }

  // ── Condition/concern search (with or without a location) ─────────────────
  if (conditionName) {
    const heading = hasCount
      ? `${countPhrase(total)}${inLoc} that treat ${conditionName}`
      : `Med spas that treat ${conditionName}${inLoc}`;
    const lead = hasCount
      ? `${BRAND} lists ${countPhrase(total)}${inLoc} that treat ${conditionName}. ${COMPARE}`
      : `Find med spas that treat ${conditionName}${inLoc} on ${BRAND}. ${COMPARE}`;
    const popularSentence = popular.length
      ? ` Common treatments include ${listPhrase(popular)}.`
      : "";
    return {
      heading,
      accent: conditionName,
      paragraphs: [`${lead}${popularSentence} ${VETTED_SENTENCE}`],
    };
  }

  // ── Location-only search ──────────────────────────────────────────────────
  if (locationLabel) {
    const heading = hasCount
      ? `${countPhrase(total)} ${locPrep} ${locationLabel}`
      : `Med spas ${locPrep} ${locationLabel}`;
    const lead = hasCount
      ? `${BRAND} lists ${countPhrase(total)} ${locPrep} ${locationLabel}. ${COMPARE}`
      : `Explore vetted med spas ${locPrep} ${locationLabel} on ${BRAND}. ${COMPARE}`;
    const popularSentence = popular.length
      ? ` Popular treatments include ${listPhrase(popular)}.`
      : "";
    return {
      heading,
      accent: locationLabel,
      paragraphs: [`${lead}${popularSentence} ${VETTED_SENTENCE}`],
    };
  }

  // ── Bare /search (no facets) ──────────────────────────────────────────────
  const popularSentence = popular.length
    ? ` Popular treatments include ${listPhrase(popular)}.`
    : "";
  return {
    heading: "Find vetted med spas near you",
    accent: "near you",
    paragraphs: [
      `${BRAND} helps you find and compare vetted med spas across the country. Search by treatment or skin concern, then compare by patient rating, treatments offered, and location.${popularSentence} ${VETTED_SENTENCE}`,
    ],
  };
}
