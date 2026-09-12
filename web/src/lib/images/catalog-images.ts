/**
 * Curated, distinct stock imagery for the treatment & condition index pages.
 * Every URL is Unsplash (allow-listed in next.config) and has been verified to
 * resolve. Kept here so the /treatments and /conditions pages stop reusing a
 * single repeated photo. Provider images are intentionally NOT handled here.
 */

const U = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=80`;

/** slug → hero image. One distinct, on-theme photo per treatment (22 total). */
export const TREATMENT_IMAGES: Record<string, string> = {
  // The 22 core treatments (2026-09-06 reduction + 3 added 2026-09-12). Photo IDs are reused rather
  // than newly sourced — every one here is already proven to load, and a broken
  // Unsplash id degrades worse than a shared photo.
  botox: U("1512290923902-8a9f81dc236c"), // facial injectable treatment
  dysport: U("1512290923902-8a9f81dc236c"), // facial injectable treatment
  "dermal-fillers": U("1487412947147-5cebf100ffc2"), // lips / face close-up
  "lip-fillers": U("1487412947147-5cebf100ffc2"), // lips / face close-up
  sculptra: U("1631730359585-38a4935cbec4"), // serum droppers
  "prp-prf": U("1631730359585-38a4935cbec4"), // serum droppers
  microneedling: U("1616394584738-fc6e612e71b9"), // facial mask / treatment
  "rf-microneedling": U("1616394584738-fc6e612e71b9"), // facial mask / treatment
  "chemical-peels": U("1540555700478-4be289fbecef"), // skincare / peel
  facials: U("1570172619644-dfd03ed5d881"), // facial treatment / brush
  hydrafacial: U("1620331311520-246422fd82f9"), // beauty device
  "laser-treatments": U("1598300042247-d088f8ab3a91"), // clinic interior
  "laser-skin-resurfacing": U("1633681926022-84c23e8cb2d6"), // modern clinic
  "laser-hair-removal": U("1519415510236-718bdfcd89c8"), // body / smooth skin
  "ipl-photofacial": U("1629909613654-28e377c37b09"), // clinical treatment room
  "body-contouring": U("1571019613454-1cb2f99b2d8b"), // body / toning
  "medical-weight-loss": U("1517836357463-d25dfeac3438"), // body / fitness
  "iv-therapy": U("1596755094514-f87e34085b2c"), // clinical consult
  "hair-restoration": U("1502823403499-6ccfcf4fb453"), // hair / portrait
  cryotherapy: U("1571019613454-1cb2f99b2d8b"), // body / recovery
  "red-light-therapy": U("1629909613654-28e377c37b09"), // clinical treatment room / device
  "hormone-therapy": U("1596755094514-f87e34085b2c"), // clinical consult / wellness

  // Retired slugs, kept so any cached page or old link renders as it did.
  kybella: U("1519824145371-296894a0daa9"), // neck & décolletage
  "pdo-threads": U("1570172619644-dfd03ed5d881"), // facial lift / brush
  "rf-skin-tightening": U("1629909613654-28e377c37b09"), // clinical treatment room
  ultherapy: U("1596755094514-f87e34085b2c"), // clinical consult / imaging
  coolsculpting: U("1517836357463-d25dfeac3438"), // body / fitness
};

/** slug → hero image, for the 14 core concerns plus the slugs they retired. */
export const CONDITION_IMAGES: Record<string, string> = {
  // The 14 core concerns (2026-09-06 reduction). Several reuse the image that
  // was curated for the retired slug they absorbed — `wrinkles` keeps the
  // fine-lines-wrinkles photo, `veins` keeps rosacea's — so the reduction did
  // not silently drop every card back to the generic fallback pool.
  wrinkles: U("1512290923902-8a9f81dc236c"),
  "fine-lines": U("1512290923902-8a9f81dc236c"),
  pigmentation: U("1616683693504-3ea7e9ad6fec"),
  "dark-spots": U("1598440947619-2c35fc9aa908"),
  melasma: U("1598440947619-2c35fc9aa908"),
  "sun-damage": U("1487412947147-5cebf100ffc2"),
  "uneven-skin-tone": U("1487412947147-5cebf100ffc2"),
  "uneven-skin-texture": U("1556228578-0d85b1a4d571"),
  acne: U("1556228578-0d85b1a4d571"),
  "acne-scars": U("1556228578-0d85b1a4d571"),
  veins: U("1551069613-1904dbdcda11"),
  "skin-laxity": U("1502823403499-6ccfcf4fb453"),
  "facial-volume-loss": U("1519824145371-296894a0daa9"),
  "hair-loss": U("1526947425960-945c6e72858f"),

  // Retired slugs, kept so that any link or cached page still using one renders
  // the same picture it always did rather than falling through to the pool.
  "fine-lines-wrinkles": U("1512290923902-8a9f81dc236c"),
  hyperpigmentation: U("1616683693504-3ea7e9ad6fec"),
  "skin-laxity-sagging": U("1502823403499-6ccfcf4fb453"),
  "double-chin-submental-fullness": U("1519824145371-296894a0daa9"),
  rosacea: U("1551069613-1904dbdcda11"),
  "stretch-marks": U("1526947425960-945c6e72858f"),
  "dark-spots-melasma": U("1598440947619-2c35fc9aa908"),
  "stubborn-body-fat": U("1518310383802-640c2de311b2"),
};

/** On-theme fallbacks for any slug not explicitly mapped (assigned stably). */
const FALLBACK_POOL = [
  U("1516975080664-ed2fc6a32937"), // beauty tools
  U("1560750588-73207b1ef5b8"), // spa
  U("1591343395902-1adcb454c4e2"), // wellness
  U("1512496015851-a90fb38ba796"), // cosmetics
  U("1544367567-0f2fcb009e0b"), // wellness / body
  U("1600334129128-685c5582fd35"), // spa detail
];

function stableIndex(key: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % mod;
}

export function treatmentImage(slug: string): string {
  return TREATMENT_IMAGES[slug] ?? FALLBACK_POOL[stableIndex(slug, FALLBACK_POOL.length)];
}

export function conditionImage(slug: string): string {
  return CONDITION_IMAGES[slug] ?? FALLBACK_POOL[stableIndex(slug, FALLBACK_POOL.length)];
}
