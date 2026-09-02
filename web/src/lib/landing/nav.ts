/**
 * Lightweight nav lists for the "Patients' Favourites" menu (used by the client
 * header dropdown) and the /treatment favourites page. Kept as plain literals so
 * the big content registries don't get pulled into the client bundle. Keep in
 * sync with `treatments.ts` / `conditions.ts`.
 */
export interface NavItem {
  label: string;
  href: string;
}

/** The Patients' Favourites landing page. `/condition` redirects here too. */
export const PATIENTS_FAV_HREF = "/patients-favourites";

export const FAV_TREATMENTS: NavItem[] = [
  { label: "Botox", href: "/treatment/botox" },
  { label: "Dermal Fillers", href: "/treatment/dermal-fillers" },
  { label: "Facials", href: "/treatment/facials" },
  { label: "Laser Treatments", href: "/treatment/laser-treatments" },
  { label: "Microneedling", href: "/treatment/microneedling" },
];

export const FAV_CONDITIONS: NavItem[] = [
  { label: "Wrinkles", href: "/condition/wrinkles" },
  { label: "Pigmentation", href: "/condition/pigmentation" },
  { label: "Veins", href: "/condition/veins" },
];
