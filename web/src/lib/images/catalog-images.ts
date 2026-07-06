/**
 * Curated, distinct stock imagery for the treatment & condition index pages.
 * Every URL is Unsplash (allow-listed in next.config) and has been verified to
 * resolve. Kept here so the /treatments and /conditions pages stop reusing a
 * single repeated photo. Provider images are intentionally NOT handled here.
 */

const U = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=80`;

/** slug → hero image. One distinct, on-theme photo per treatment (15 total). */
export const TREATMENT_IMAGES: Record<string, string> = {
  botox: U("1512290923902-8a9f81dc236c"), // facial injectable treatment
  "dermal-fillers": U("1487412947147-5cebf100ffc2"), // lips / face close-up
  kybella: U("1519824145371-296894a0daa9"), // neck & décolletage
  "pdo-threads": U("1570172619644-dfd03ed5d881"), // facial lift / brush
  "prp-prf": U("1631730359585-38a4935cbec4"), // serum droppers
  microneedling: U("1616394584738-fc6e612e71b9"), // facial mask / treatment
  "chemical-peels": U("1540555700478-4be289fbecef"), // skincare / peel
  hydrafacial: U("1620331311520-246422fd82f9"), // beauty device
  "rf-skin-tightening": U("1629909613654-28e377c37b09"), // clinical treatment room
  ultherapy: U("1596755094514-f87e34085b2c"), // clinical consult / imaging
  "laser-skin-resurfacing": U("1633681926022-84c23e8cb2d6"), // modern clinic
  "laser-hair-removal": U("1519415510236-718bdfcd89c8"), // body / smooth skin
  "ipl-photofacial": U("1598300042247-d088f8ab3a91"), // clinic interior
  coolsculpting: U("1517836357463-d25dfeac3438"), // body / fitness
  "body-contouring": U("1571019613454-1cb2f99b2d8b"), // body / toning
};

/** slug → hero image. One distinct, on-theme photo per condition (10 total). */
export const CONDITION_IMAGES: Record<string, string> = {
  "fine-lines-wrinkles": U("1512290923902-8a9f81dc236c"),
  "acne-scars": U("1556228578-0d85b1a4d571"),
  hyperpigmentation: U("1616683693504-3ea7e9ad6fec"),
  "skin-laxity-sagging": U("1502823403499-6ccfcf4fb453"),
  "double-chin-submental-fullness": U("1519824145371-296894a0daa9"),
  "sun-damage": U("1487412947147-5cebf100ffc2"),
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
