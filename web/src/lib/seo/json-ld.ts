/**
 * Shared JSON-LD builders. Centralizes the structured-data shapes that were
 * previously hand-written (and subtly inconsistent) across the blog, the Botox
 * page, and the homepage FAQ. Every node here is rendered through the
 * escape-hardened <JsonLd> component — never a raw <script>.
 */
import { absoluteUrl } from "@/lib/site";
import type { BreadcrumbItem } from "@/components/shared/breadcrumbs";
import { toStateCode } from "@/lib/location/states";
import type { ClinicPageData, ClinicLocation } from "@/lib/clinics/queries";

// ─── BreadcrumbList ───────────────────────────────────────────────────────────

/**
 * A `BreadcrumbList` node from the same `BreadcrumbItem[]` the visual
 * <Breadcrumbs> renders, so the two never drift. `item` URLs are made absolute
 * (schema.org wants fully-qualified URLs); the last crumb usually omits `href`.
 */
export function breadcrumbListJsonLd(items: BreadcrumbItem[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: absoluteUrl(item.href) } : {}),
    })),
  };
}

// ─── FAQPage ──────────────────────────────────────────────────────────────────

export interface FaqItem {
  q: string;
  a: string;
}

/** A `FAQPage` node from a list of question/answer pairs. */
export function faqPageJsonLd(faqs: FaqItem[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };
}

// ─── Opening hours ──────────────────────────────────────────────────────────

// Clinic hours are a jsonb map keyed by UPPERCASE full day name:
//   { "MONDAY": { open: "09:00", close: "17:00", is_open: true }, ... }
// (see practices/[slug]/hours.tsx). Values are 24h "HH:MM" or already-12h.
const DAY_TO_SCHEMA: [string, string][] = [
  ["MONDAY", "Monday"],
  ["TUESDAY", "Tuesday"],
  ["WEDNESDAY", "Wednesday"],
  ["THURSDAY", "Thursday"],
  ["FRIDAY", "Friday"],
  ["SATURDAY", "Saturday"],
  ["SUNDAY", "Sunday"],
];

type HoursMap = Record<
  string,
  { open: string | null; close: string | null; is_open: boolean }
>;

/** "5:00 PM" / "17:00" → "17:00"; null/unparseable → null. Inverse of hours.tsx's to12h. */
function to24h(t: string | null): string | null {
  if (!t) return null;
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*([ap]m)?$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const mer = m[3]?.toLowerCase();
  if (mer === "pm" && h < 12) h += 12;
  if (mer === "am" && h === 12) h = 0;
  if (h < 0 || h > 23) return null;
  return `${String(h).padStart(2, "0")}:${min}`;
}

/**
 * `OpeningHoursSpecification[]` from the clinic hours jsonb. Skips days that are
 * closed or missing a well-formed open/close pair. Returns [] when no structured
 * hours are present (caller omits the field).
 */
export function openingHoursSpecification(hours: unknown) {
  if (!hours || typeof hours !== "object") return [];
  const map = hours as HoursMap;
  const specs: {
    "@type": "OpeningHoursSpecification";
    dayOfWeek: string;
    opens: string;
    closes: string;
  }[] = [];
  for (const [key, dayName] of DAY_TO_SCHEMA) {
    const h = map[key];
    if (!h || !h.is_open) continue;
    const opens = to24h(h.open);
    const closes = to24h(h.close);
    if (!opens || !closes) continue;
    specs.push({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${dayName}`,
      opens,
      closes,
    });
  }
  return specs;
}

// ─── MedicalBusiness (practice page) ──────────────────────────────────────────

export interface MedicalBusinessInput {
  clinic: ClinicPageData["clinic"];
  /** Representative location whose address/geo/phone anchor the schema. */
  primaryLocation: ClinicLocation | null;
  stats: ClinicPageData["stats"];
  reviews: ClinicPageData["reviews"];
  gallery: { source_url: string }[];
  /** Absolute URL of the practice page. */
  url: string;
}

/**
 * A `MedicalBusiness` node for a clinic. Every field is emitted only when its
 * source data is actually present — no fabricated values. Notably, individual
 * reviews carry NO `datePublished`: the reviews table has no authentic review
 * date (only a scrape timestamp), so we don't invent one.
 */
export function medicalBusinessJsonLd(input: MedicalBusinessInput) {
  const { clinic, primaryLocation, stats, reviews, gallery, url } = input;

  const node: Record<string, unknown> = {
    "@type": "MedicalBusiness",
    "@id": `${url}#business`,
    name: clinic.name,
    url,
  };

  if (clinic.logo_url) node.logo = { "@type": "ImageObject", url: clinic.logo_url };

  const images = gallery.map((g) => g.source_url).filter(Boolean);
  if (images.length) node.image = images.slice(0, 8);
  else if (clinic.logo_url) node.image = clinic.logo_url;

  const telephone = clinic.phone ?? primaryLocation?.phone ?? null;
  if (telephone) node.telephone = telephone;
  if (clinic.email) node.email = clinic.email;

  // Address — parts live on clinic_locations; clinic.address is a street fallback.
  const street = (primaryLocation?.address ?? clinic.address)?.trim() || null;
  const city = primaryLocation?.city ?? null;
  const stateCode = primaryLocation?.state
    ? (toStateCode(primaryLocation.state) ?? primaryLocation.state)
    : null;
  const zip = primaryLocation?.zip ?? null;
  if (street || city || stateCode || zip) {
    node.address = {
      "@type": "PostalAddress",
      ...(street ? { streetAddress: street } : {}),
      ...(city ? { addressLocality: city } : {}),
      ...(stateCode ? { addressRegion: stateCode } : {}),
      ...(zip ? { postalCode: zip } : {}),
      addressCountry: "US",
    };
  }

  if (primaryLocation?.lat != null && primaryLocation?.lng != null) {
    node.geo = {
      "@type": "GeoCoordinates",
      latitude: primaryLocation.lat,
      longitude: primaryLocation.lng,
    };
  }

  const sameAs = [
    clinic.website,
    clinic.instagram_url,
    clinic.facebook_url,
    clinic.tiktok_url,
    clinic.youtube_url,
    clinic.x_url,
    clinic.linkedin_url,
    clinic.yelp_url,
    clinic.google_maps_url ?? primaryLocation?.google_maps_url ?? null,
  ].filter((u): u is string => Boolean(u));
  if (sameAs.length) node.sameAs = sameAs;

  const hoursSpec = openingHoursSpecification(clinic.hours);
  if (hoursSpec.length) node.openingHoursSpecification = hoursSpec;

  // Rating comes back from pg as a string; coerce and guard.
  const ratingValue = stats.rating != null ? Number(stats.rating) : NaN;
  if (Number.isFinite(ratingValue) && ratingValue > 0) {
    node.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue,
      bestRating: 5,
      ...(stats.review_count != null && stats.review_count > 0
        ? { reviewCount: stats.review_count }
        : {}),
    };
  }

  // Only reviews that carry both a body and a rating → clean Review nodes.
  const reviewNodes = reviews
    .filter((r) => r.rating != null && r.body && r.body.trim())
    .slice(0, 10)
    .map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.reviewer_name?.trim() || "Anonymous" },
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
      reviewBody: r.body,
    }));
  if (reviewNodes.length) node.review = reviewNodes;

  return node;
}
