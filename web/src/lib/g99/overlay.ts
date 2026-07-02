/**
 * g99/overlay.ts — merge G99 clinic metadata onto a scraped ClinicPreview.
 *
 * Rule: GAP-ONLY. The website scrape always wins; G99 only fills fields the
 * scrape left empty. Shared by the import-preview route and tests so the merge
 * behaviour is defined in exactly one place.
 */

import type { ClinicPreview } from "@/lib/admin/scrape-preview";
import type { G99Clinic } from "@/lib/g99/source";
import { parseUSAddress, normalizeState } from "@/lib/address-parser";

export function firstNonEmpty(...vals: Array<string | null | undefined>): string | null {
  for (const v of vals) if (v && v.trim()) return v.trim();
  return null;
}

/** Fill scrape gaps with G99 fields without clobbering anything the scrape found. */
export function overlayG99(
  preview: ClinicPreview,
  clinic: G99Clinic,
  bizName: string | null
): ClinicPreview {
  const parsed = parseUSAddress(clinic.address);

  // ensure a primary location exists
  const locations = preview.locations.length > 0 ? preview.locations : [{}];
  const primary = { ...locations[0] };

  primary.address = firstNonEmpty(primary.address, clinic.address);
  primary.city = firstNonEmpty(primary.city, clinic.city, parsed?.city);
  primary.state = firstNonEmpty(primary.state, normalizeState(clinic.state), parsed?.state);
  primary.zip = firstNonEmpty(primary.zip, parsed?.zip);
  primary.phone = firstNonEmpty(primary.phone, clinic.contact_number);
  primary.about = firstNonEmpty(primary.about, clinic.about);
  primary.google_my_business = firstNonEmpty(primary.google_my_business, clinic.google_my_business);
  primary.maps_url = firstNonEmpty(primary.maps_url, clinic.google_my_business);
  primary.instagram_url = firstNonEmpty(primary.instagram_url, clinic.instagram);
  primary.facebook_url = firstNonEmpty(primary.facebook_url, clinic.facebook);
  primary.tiktok_url = firstNonEmpty(primary.tiktok_url, clinic.tiktok);
  primary.x_url = firstNonEmpty(primary.x_url, clinic.twitter);
  primary.yelp_url = firstNonEmpty(primary.yelp_url, clinic.yelp_url);
  primary.booking_url = firstNonEmpty(primary.booking_url, clinic.appointment_url);

  locations[0] = primary;

  // business name: keep the scraped name if found, else fall back to G99.
  const business = {
    ...preview.business,
    name: firstNonEmpty(preview.business?.name, clinic.name, bizName) ?? "",
  };

  // POLICY: treatments (preview.services) and concerns (preview.concerns) are
  // DELIBERATELY not overlaid from G99. Per product decision the G99 DB is not a
  // trusted source for what a clinic offers — the website scrape is the ONLY
  // source of treatments/concerns. We spread `...preview` unchanged so those
  // fields pass through exactly as scraped; do NOT add G99 service merging here.
  return { ...preview, business, locations };
}
