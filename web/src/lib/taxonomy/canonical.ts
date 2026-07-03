/**
 * canonical.ts — curated canonical service taxonomy + alias map + matcher.
 *
 * Source of truth for the *clean* public list of medspa treatments. Messy,
 * inconsistent scraped service names (with ®/™, brand variants, marketing
 * phrasing) are mapped onto this curated set via the alias map below and the
 * matchService() resolver.
 *
 * PHASE 0: the catalog is intentionally restricted to the 15 priority
 * treatments and 10 priority conditions that cover the bulk of medspa search
 * volume. No additional services or concerns are part of the launch set —
 * scraped services that don't resolve to one of the 15 stay unmatched.
 *
 * Seeded into the `services` (and `concerns`) tables by
 * scripts/reconcile-taxonomy.ts. Each CANONICAL_SERVICES entry UPSERTs into
 * `services` (ON CONFLICT (slug)); anything outside this set is deleted.
 * Aliases are stored as a TEXT[] column.
 *
 * Conventions mirror src/lib/treatments/catalog.ts and
 * src/lib/concerns/catalog.ts.
 */

export type ServiceCategory =
  | "Injectables"
  | "Skin"
  | "Laser"
  | "Body"
  | "Wellness"
  | "Hair"
  | "Other";

export interface CanonicalService {
  name: string;
  slug: string;
  category: ServiceCategory;
  /** lowercased alias strings; every messy scraped name must resolve here */
  aliases: string[];
  summary: string;
  description: string;
  treatment_time: string;
  results_timeline: string;
  results_duration: string;
  is_published: boolean;
}

export interface CanonicalConcern {
  name: string;
  slug: string;
  aliases: string[];
  /**
   * Curated mapping: the canonical service slugs that treat this concern.
   * This is the authoritative concern↔service map used to seed
   * concern_services and to derive treatable concerns in the add-clinic flow.
   * Every slug here MUST exist in CANONICAL_SERVICES.
   */
  serviceSlugs: string[];
}

/**
 * CANONICAL_SERVICES — the 15 Phase-0 priority treatments.
 *
 * Aliases (lowercased, ®/™ stripped) fold the common brand names and scraped
 * variants of each treatment onto its canonical slug so matchService() keeps
 * resolving real-world service names even though the catalog is now narrow.
 */
export const CANONICAL_SERVICES: CanonicalService[] = [
  // ── Injectables ──────────────────────────────────────────────────────────
  {
    name: "Botox",
    slug: "botox",
    category: "Injectables",
    aliases: [
      "botox",
      "tox",
      "neuromodulator",
      "neuromodulators",
      "neurotoxin",
      "botulinum",
      "botulinum toxin",
      "onabotulinumtoxina",
      "wrinkle relaxer",
      "anti-wrinkle injections",
      "dysport",
      "abobotulinumtoxina",
      "xeomin",
      "jeuveau",
      "daxxify",
      "newtox",
    ],
    summary:
      "Smooths dynamic wrinkles by relaxing the facial muscles responsible for fine lines.",
    description:
      "Botox and other neuromodulators are non-surgical injectables that temporarily relax targeted facial muscles to soften the appearance of fine lines and wrinkles. They are most commonly used on forehead lines, frown lines, and crow's feet while preserving natural, expressive movement.",
    treatment_time: "20-30 mins",
    results_timeline: "Within 1 week",
    results_duration: "3-4 Months",
    is_published: true,
  },
  {
    name: "Dermal Fillers",
    slug: "dermal-fillers",
    category: "Injectables",
    aliases: [
      "dermal fillers",
      "dermal filler",
      "filler",
      "fillers",
      "lip filler",
      "lip fillers",
      "cheek filler",
      "under eye filler",
      "under-eye filler",
      "tear trough filler",
      "hyaluronic acid",
      "juvederm",
      "restylane",
      "rha",
      "versa",
      "skinvive",
      "dermal fillers & biostimulators",
      "dermal fillers and biostimulators",
      "liquid bbl",
      "renuva",
      "full facial balancing",
      "facial balancing",
      "sculptra",
      "radiesse",
      "biostimulator",
      "biostimulators",
      "poly-l-lactic acid",
      "collagen stimulator",
    ],
    summary:
      "Restores lost volume and smooths folds using injectable hyaluronic acid and volumizing gels.",
    description:
      "Dermal fillers are injectable gels, most often hyaluronic acid based, used to restore lost facial volume, smooth deep folds, and refine the contours of the cheeks, lips, under-eyes, and jawline. Collagen-stimulating options such as Sculptra and Radiesse deliver gradual, longer-lasting volume restoration without surgery.",
    treatment_time: "30-45 mins",
    results_timeline: "Immediately",
    results_duration: "6-18 Months",
    is_published: true,
  },
  {
    name: "Kybella",
    slug: "kybella",
    category: "Injectables",
    aliases: [
      "kybella",
      "kybella & liquid lipo",
      "kybella and liquid lipo",
      "liquid lipo",
      "deoxycholic acid",
      "fat dissolving injections",
      "submental fat reduction",
    ],
    summary:
      "An injectable that permanently dissolves fat under the chin without surgery.",
    description:
      "Kybella is an FDA-approved injectable that uses synthetic deoxycholic acid to permanently destroy fat cells beneath the chin. Over a series of sessions it reduces the appearance of a double chin to reveal a more defined, contoured jawline without surgery.",
    treatment_time: "20-30 mins",
    results_timeline: "4-6 weeks",
    results_duration: "Permanent",
    is_published: true,
  },
  {
    name: "PDO Threads",
    slug: "pdo-threads",
    category: "Injectables",
    aliases: [
      "pdo threads",
      "pdo thread",
      "thread lift",
      "thread lifts",
      "threads",
      "pdo",
      "pdo thread lift",
    ],
    summary:
      "Dissolvable sutures that lift loose skin and stimulate new collagen.",
    description:
      "PDO threads are dissolvable polydioxanone sutures placed beneath the skin to lift and tighten sagging areas while stimulating natural collagen production. This minimally invasive treatment offers an immediate, subtle lift with gradual, long-lasting firming of the face and neck.",
    treatment_time: "45-60 mins",
    results_timeline: "Immediately",
    results_duration: "12-18 Months",
    is_published: true,
  },
  {
    name: "PRP (Platelet-Rich Plasma)",
    slug: "prp-prf",
    category: "Injectables",
    aliases: [
      "prp",
      "prf",
      "prp/prf",
      "platelet rich plasma",
      "platelet-rich plasma",
      "platelet rich fibrin",
      "platelet-rich fibrin",
      "regenerative aesthetics (prp/prf)",
      "regenerative aesthetics",
      "vampire facial",
      "vampire facelift",
      "prp facial",
      "prp hair restoration",
      "prp microneedling",
    ],
    summary:
      "Uses the body's own platelets to rejuvenate skin, restore volume, and boost healing.",
    description:
      "PRP and PRF concentrate the growth factors in your own blood to stimulate collagen, improve skin texture and tone, and support natural healing. Commonly used for facial rejuvenation, under-eye revitalization, and hair restoration with little downtime.",
    treatment_time: "45-60 mins",
    results_timeline: "3-6 weeks",
    results_duration: "6-12 Months",
    is_published: true,
  },

  // ── Skin ───────────────────────────────────────────────────────────────
  {
    name: "Microneedling",
    slug: "microneedling",
    category: "Skin",
    aliases: [
      "microneedling",
      "micro-needling",
      "micro needling",
      "collagen induction",
      "collagen induction therapy",
      "skinpen",
      "rf microneedling",
      "radiofrequency microneedling",
      "rf microneedling and microneedling",
      "microneedling / rf microneedling",
      "microneedling/rf microneedling",
      "morpheus8",
      "morpheus 8",
      "morpheus8 treatment",
      "sylfirm x",
      "sylfirm x rf microneedling",
      "sylfirm",
      "vivace",
      "secret rf",
      "ruma gold microchannel treatment",
      "ruma gold microchannel",
      "ruma gold",
    ],
    summary:
      "Stimulates collagen with fine micro-channels to refine skin texture, scars, and tone.",
    description:
      "Microneedling uses fine needles to create controlled micro-channels in the skin, triggering natural collagen and elastin production. RF microneedling platforms such as Morpheus8 and Sylfirm X add radiofrequency heat to remodel deeper tissue. Over a series of sessions it improves texture, fine lines, acne scarring, and overall radiance with little downtime.",
    treatment_time: "45-60 mins",
    results_timeline: "1-2 weeks",
    results_duration: "6-12 Months",
    is_published: true,
  },
  {
    name: "Chemical Peels",
    slug: "chemical-peels",
    category: "Skin",
    aliases: [
      "chemical peels",
      "chemical peel",
      "peel",
      "peels",
      "vi peel",
      "perfect derma peel",
      "jessner peel",
      "tca peel",
      "glycolic peel",
    ],
    summary:
      "Resurfaces dull, damaged skin with exfoliating acid solutions for a fresh glow.",
    description:
      "Chemical peels use medical-grade acid solutions to exfoliate the outermost layers of skin, revealing smoother, brighter, more even-toned skin underneath. Available from light to deep formulations, they target fine lines, sun damage, acne, and hyperpigmentation with customizable downtime.",
    treatment_time: "30-45 mins",
    results_timeline: "3-7 days",
    results_duration: "1-3 Months",
    is_published: true,
  },
  {
    name: "HydraFacial",
    slug: "hydrafacial",
    category: "Skin",
    aliases: [
      "hydrafacial",
      "hydra facial",
      "hydro facial",
      "hydrodermabrasion",
      "facial",
      "facials",
      "facial treatment",
      "facial treatments",
      "medical facial",
      "medical-grade facial",
      "signature facial",
      "dermaplaning facial",
    ],
    summary:
      "A medical-grade facial that cleanses, exfoliates, extracts, and hydrates in one session.",
    description:
      "HydraFacial is a multi-step, medical-grade facial that cleanses, gently exfoliates, extracts impurities, and infuses the skin with hydrating serums and antioxidants. It improves tone, clarity, and radiance with no downtime, making it a popular maintenance treatment for nearly every skin type.",
    treatment_time: "30-45 mins",
    results_timeline: "Immediately",
    results_duration: "2-4 Weeks",
    is_published: true,
  },
  {
    name: "RF Skin Tightening",
    slug: "rf-skin-tightening",
    category: "Skin",
    aliases: [
      "rf skin tightening",
      "radiofrequency skin tightening",
      "skin tightening",
      "non-surgical skin tightening",
      "skin firming",
      "thermage",
      "exilis",
      "evoke",
      "evolve",
      "forma",
      "votiva",
      "everesse skin tightening",
      "everesse",
      "xerf",
    ],
    summary:
      "Radiofrequency energy that firms and lifts lax skin without surgery or needles.",
    description:
      "RF skin tightening uses radiofrequency energy to heat the deeper layers of the skin, contracting existing collagen and stimulating new collagen production. Devices such as Thermage and Exilis gradually firm and lift lax skin on the face, neck, and body with little to no downtime.",
    treatment_time: "30-60 mins",
    results_timeline: "3-6 weeks",
    results_duration: "1-2 Years",
    is_published: true,
  },
  {
    name: "Ultherapy",
    slug: "ultherapy",
    category: "Skin",
    aliases: [
      "ultherapy",
      "ulthera",
      "ultrasound skin tightening",
      "ultrasound therapy",
      "ultrasound lift",
      "micro-focused ultrasound",
      "sofwave",
      "high intensity focused ultrasound",
      "hifu",
    ],
    summary:
      "Focused ultrasound that lifts and tightens the skin from deep within, non-surgically.",
    description:
      "Ultherapy uses micro-focused ultrasound energy to reach the deep foundational layers of the skin, stimulating collagen to lift and tighten the brow, neck, and under-chin. As the only FDA-cleared ultrasound lift, it delivers gradual, natural-looking firming over two to three months with no downtime.",
    treatment_time: "30-90 mins",
    results_timeline: "2-3 months",
    results_duration: "1-2 Years",
    is_published: true,
  },

  // ── Laser ────────────────────────────────────────────────────────────────
  {
    name: "Laser Skin Resurfacing",
    slug: "laser-skin-resurfacing",
    category: "Laser",
    aliases: [
      "laser skin resurfacing",
      "laser resurfacing",
      "co2 laser",
      "fractional laser",
      "fraxel",
      "halo laser",
      "erbium laser",
      "laser peels",
      "laser peel",
      "laser treatments",
      "laser treatment",
      "laser skin treatments",
      "laser skin treatment",
      "nightlase",
      "endolift",
      // fractional / ablative resurfacing device brand names
      "moxi",
      "moxi bbl laser",
      "moxi bbl",
      "moxi laser",
      "halo",
      "tetra",
      "tetra co2",
      "cartessa tetra",
      "contour trl",
      "profractional",
      "clear + brilliant",
      "clear and brilliant",
      "ultraclear",
    ],
    summary:
      "Resurfaces and rejuvenates skin with laser energy to smooth texture, tone, and lines.",
    description:
      "Laser skin resurfacing uses precisely controlled laser energy to remove damaged surface skin and stimulate collagen in the layers beneath. It improves fine lines, sun damage, scarring, and uneven texture, revealing smoother, brighter, more youthful skin over a tailored treatment course.",
    treatment_time: "30-60 mins",
    results_timeline: "1-2 weeks",
    results_duration: "1-3 Years",
    is_published: true,
  },
  {
    name: "Laser Hair Removal",
    slug: "laser-hair-removal",
    category: "Laser",
    aliases: [
      "laser hair removal",
      "lhr",
      "laser hair",
      "hair removal",
      "diode laser hair removal",
    ],
    summary:
      "Targets hair follicles with light energy for long-lasting, smooth skin.",
    description:
      "Laser hair removal uses concentrated light energy to target and disable hair follicles, progressively reducing unwanted hair growth. Performed over a series of sessions, it delivers long-lasting smoothness on the face and body with minimal discomfort and no downtime.",
    treatment_time: "15-60 mins",
    results_timeline: "After 2-3 sessions",
    results_duration: "Long-term",
    is_published: true,
  },
  {
    name: "IPL / Photofacial",
    slug: "ipl-photofacial",
    category: "Laser",
    aliases: [
      "ipl",
      "ipl photofacial",
      "photofacial",
      "photo facial",
      "intense pulsed light",
      "bbl",
      "broadband light",
      "forever young bbl",
      "photorejuvenation",
    ],
    summary:
      "Pulsed light that clears sun spots, redness, and uneven tone for clearer skin.",
    description:
      "IPL photofacials use broadband intense pulsed light to target pigment and visible blood vessels, fading sun spots, redness, and uneven tone while boosting overall clarity. A series of quick, no-downtime sessions leaves the skin brighter and more even.",
    treatment_time: "20-40 mins",
    results_timeline: "1-2 weeks",
    results_duration: "6-12 Months",
    is_published: true,
  },

  // ── Body ─────────────────────────────────────────────────────────────────
  {
    name: "CoolSculpting",
    slug: "coolsculpting",
    category: "Body",
    aliases: [
      "coolsculpting",
      "cool sculpting",
      "coolsculpting elite",
      "cryolipolysis",
      "fat freezing",
      "fat-freezing",
    ],
    summary:
      "Freezes and permanently eliminates stubborn fat without surgery or downtime.",
    description:
      "CoolSculpting (cryolipolysis) uses controlled cooling to freeze and permanently destroy stubborn fat cells in areas that resist diet and exercise, such as the abdomen, flanks, and under the chin. The body naturally clears the treated cells over the following weeks for a more contoured shape with no surgery or downtime.",
    treatment_time: "35-60 mins",
    results_timeline: "1-3 months",
    results_duration: "Long-term",
    is_published: true,
  },
  {
    name: "Body Contouring",
    slug: "body-contouring",
    category: "Body",
    aliases: [
      "body contouring",
      "body sculpting",
      "fat reduction",
      "emsculpt",
      "emsculpt neo",
      "trusculpt",
      "trusculpt id",
      "sculpsure",
      "body fx",
      "muscle toning",
    ],
    summary:
      "Non-surgical contouring that reduces fat and tones muscle to refine body shape.",
    description:
      "Body contouring treatments target stubborn fat and lax tissue while toning underlying muscle to refine the contours of the abdomen, flanks, arms, and more. Non-surgical platforms such as EmSculpt and truSculpt reduce fat and build muscle definition with little to no downtime.",
    treatment_time: "30-60 mins",
    results_timeline: "3-12 weeks",
    results_duration: "Long-term",
    is_published: true,
  },
];

/**
 * CANONICAL_CONCERNS — the 10 Phase-0 priority conditions.
 *
 * serviceSlugs is the curated concern↔service map: the canonical treatments
 * that address each concern. It seeds concern_services and powers the
 * "treatable concerns" view in the add-clinic flow.
 */
export const CANONICAL_CONCERNS: CanonicalConcern[] = [
  {
    name: "Wrinkles & Fine Lines",
    slug: "fine-lines-wrinkles",
    aliases: ["wrinkle", "wrinkles", "fine line", "fine lines", "anti-aging", "anti aging"],
    serviceSlugs: [
      "botox",
      "dermal-fillers",
      "microneedling",
      "rf-skin-tightening",
      "laser-skin-resurfacing",
    ],
  },
  {
    name: "Acne Scars",
    slug: "acne-scars",
    aliases: ["acne scar", "acne scars", "scarring", "pitted scars", "textured skin"],
    serviceSlugs: [
      "microneedling",
      "chemical-peels",
      "laser-skin-resurfacing",
      "rf-skin-tightening",
    ],
  },
  {
    name: "Hyperpigmentation",
    slug: "hyperpigmentation",
    aliases: ["hyperpigmentation", "uneven skin tone", "discoloration", "post-inflammatory hyperpigmentation"],
    serviceSlugs: [
      "chemical-peels",
      "ipl-photofacial",
      "laser-skin-resurfacing",
      "microneedling",
    ],
  },
  {
    name: "Loose & Sagging Skin",
    slug: "skin-laxity-sagging",
    aliases: ["laxity", "sagging", "loose skin", "skin laxity", "jowls", "tightening"],
    serviceSlugs: [
      "ultherapy",
      "rf-skin-tightening",
      "pdo-threads",
      "microneedling",
    ],
  },
  {
    name: "Double Chin",
    slug: "double-chin-submental-fullness",
    aliases: ["double chin", "submental fullness", "submental fat", "chin fat"],
    serviceSlugs: ["kybella", "coolsculpting", "rf-skin-tightening"],
  },
  {
    name: "Sun Damage",
    slug: "sun-damage",
    aliases: ["sun damage", "sun spots", "photodamage", "sun-damaged skin"],
    serviceSlugs: ["ipl-photofacial", "chemical-peels", "laser-skin-resurfacing"],
  },
  {
    name: "Rosacea",
    slug: "rosacea",
    aliases: ["rosacea", "facial redness", "flushing", "broken capillaries"],
    serviceSlugs: ["ipl-photofacial", "laser-skin-resurfacing"],
  },
  {
    name: "Stretch Marks",
    slug: "stretch-marks",
    aliases: ["stretch marks", "striae", "stretch mark"],
    serviceSlugs: ["microneedling", "laser-skin-resurfacing", "rf-skin-tightening"],
  },
  {
    name: "Dark Spots & Melasma",
    slug: "dark-spots-melasma",
    aliases: ["dark spots", "melasma", "age spots", "brown spots", "pigment"],
    serviceSlugs: ["chemical-peels", "ipl-photofacial", "laser-skin-resurfacing"],
  },
  {
    name: "Stubborn Body Fat",
    slug: "stubborn-body-fat",
    aliases: ["stubborn fat", "body fat", "unwanted fat", "fat reduction", "contouring"],
    serviceSlugs: ["coolsculpting", "body-contouring", "kybella"],
  },
];

// ──────────────────────────────────────────────────────────────────────────
// Matching
// ──────────────────────────────────────────────────────────────────────────

/**
 * normalize(raw) — lowercases, strips ®/™ and punctuation, collapses
 * whitespace. The canonical form used for exact/alias comparison.
 */
export function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[®™©]/g, "")
    // turn any punctuation/symbols into spaces (keep letters, digits, spaces)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface MatchResult {
  slug: string | null;
  confidence: number;
}

// ──────────────────────────────────────────────────────────────────────────
// Noise detection
// ──────────────────────────────────────────────────────────────────────────

/** Exact (normalized) tokens that are nav / CTA / social / legal chrome, never services. */
const NOISE_EXACT = new Set<string>([
  // social handles
  "facebook", "facebook f", "facebook-f", "instagram", "tiktok", "youtube",
  "twitter", "x", "linkedin", "pinterest", "yelp", "google",
  // nav / CTA
  "apply now", "book now", "book your appointment", "book an appointment",
  "book appointment", "book a consultation", "book a visit", "book today",
  "schedule now", "schedule a consultation", "get started", "learn more",
  "read more", "view all", "see all", "click here", "go to top", "back to top",
  "home", "about", "about us", "contact", "contact us", "menu", "search",
  "login", "log in", "sign in", "sign up", "register",
  // legal / footer
  "privacy policy", "privacy", "terms", "terms and conditions",
  "terms of service", "terms of use", "cookie policy", "accessibility",
  "accessibility statement", "sitemap", "all rights reserved", "copyright",
  // misc chrome
  "resources", "testimonials", "reviews", "news", "blog", "blogs", "press",
  "media", "care credit", "carecredit", "cherry", "financing", "gift card",
  "gift cards", "specials", "promotions", "faq", "faqs", "shop", "store",
  "patient portal", "portal", "careers", "team", "our team", "meet the team",
]);

/** street-suffix tokens — an item with one of these AND a digit is an address */
const STREET_RE =
  /\b(st|street|ste|suite|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|hwy|highway|pkwy|parkway|ct|court|pl|place|way|unit|fl|floor|bldg|building)\b/i;

/**
 * isLikelyNoise(name) — true for scraper-junk that is clearly not a real
 * service (URLs, social handles, nav/CTA/legal chrome, street addresses,
 * city-only tokens, and out-of-range lengths). Conservative by design — it
 * only flags obvious non-services so real treatments are never hidden.
 */
export function isLikelyNoise(name: string): boolean {
  const raw = (name ?? "").trim();
  // length bounds (count on the raw trimmed string)
  if (raw.length < 3 || raw.length > 60) return true;

  const lower = raw.toLowerCase();

  // URLs / emails / handles
  if (/https?:\/\//i.test(raw)) return true;
  if (/\b[a-z0-9.-]+\.(com|net|org|io|co|us|biz)\b/i.test(lower)) return true;
  if (/^@/.test(raw) || lower.includes("@")) return true;

  // must contain at least one letter to be a service name at all
  if (!/[a-z]/i.test(raw)) return true;

  const norm = normalize(raw);
  if (!norm) return true;

  // exact nav/CTA/social/legal chrome
  if (NOISE_EXACT.has(norm)) return true;

  // street address: has digits + a street suffix word
  if (/\d/.test(raw) && STREET_RE.test(raw)) return true;

  // bare phone / zip-like numeric-heavy strings
  if (/^[\d\s().+-]+$/.test(raw)) return true;

  // city-only token: one or two Capitalized words, no digits, that don't
  // resolve to any canonical service (e.g. "Wellesley", "Salt Lake City").
  if (
    /^[A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2}$/.test(raw) &&
    !/\d/.test(raw) &&
    matchService(raw).slug === null &&
    // a single common service word like "Facials"/"Microneedling" should pass;
    // city tokens are only flagged when they don't match the taxonomy at all
    raw.split(/\s+/).length <= 3
  ) {
    // only treat as noise if it also has no service-ish keyword
    if (!/(therapy|treatment|facial|peel|laser|botox|filler|skin|hair|removal|lift|microneedling|wellness|injection|sculpt|tox)/i.test(lower)) {
      return true;
    }
  }

  return false;
}

/** lazily-built lookup of normalized name/alias -> slug */
let aliasIndex: Map<string, string> | null = null;

function buildAliasIndex(): Map<string, string> {
  const index = new Map<string, string>();
  for (const svc of CANONICAL_SERVICES) {
    index.set(normalize(svc.name), svc.slug);
    index.set(normalize(svc.slug), svc.slug);
    for (const alias of svc.aliases) {
      index.set(normalize(alias), svc.slug);
    }
  }
  return index;
}

/** token set of a normalized string (used for Dice similarity) */
function tokenSet(s: string): Set<string> {
  return new Set(s.split(" ").filter(Boolean));
}

/** Sørensen–Dice coefficient over two token sets */
function diceCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const tok of a) if (b.has(tok)) intersection += 1;
  return (2 * intersection) / (a.size + b.size);
}

/**
 * matchService(rawName) — resolves a messy scraped service name to a canonical
 * slug.
 *
 * - exact / alias match → { slug, confidence: 1.0 }   ('matched')
 * - otherwise fuzzy via Dice similarity on token sets:
 *     - best score >= 0.55 → { slug, confidence }      ('auto')
 *     - else → { slug: null, confidence }
 */
export function matchService(rawName: string): MatchResult {
  const norm = normalize(rawName);
  if (!norm) return { slug: null, confidence: 0 };

  aliasIndex ??= buildAliasIndex();

  // 1. exact / alias match
  const exact = aliasIndex.get(norm);
  if (exact) return { slug: exact, confidence: 1.0 };

  // 2. fuzzy — Dice coefficient over token sets against every name + alias
  const target = tokenSet(norm);
  let bestSlug: string | null = null;
  let bestScore = 0;

  for (const svc of CANONICAL_SERVICES) {
    const candidates = [svc.name, svc.slug, ...svc.aliases];
    for (const cand of candidates) {
      const score = diceCoefficient(target, tokenSet(normalize(cand)));
      if (score > bestScore) {
        bestScore = score;
        bestSlug = svc.slug;
      }
    }
  }

  if (bestScore >= 0.55) {
    return { slug: bestSlug, confidence: bestScore };
  }
  return { slug: null, confidence: bestScore };
}

/** All canonical (Phase-0 priority) service slugs, in catalog order. */
export const PRIORITY_SERVICE_SLUGS: string[] = CANONICAL_SERVICES.map(
  (s) => s.slug
);

/** concern slug → curated service slugs (the authoritative concern↔service map). */
export const CONCERN_SERVICE_MAP: Record<string, string[]> = Object.fromEntries(
  CANONICAL_CONCERNS.map((c) => [c.slug, c.serviceSlugs])
);

/**
 * concernsTreatedBy(serviceSlugs) — given a set of canonical service slugs,
 * return the concern slugs those services can treat (per CONCERN_SERVICE_MAP),
 * in CANONICAL_CONCERNS order.
 */
export function concernsTreatedBy(serviceSlugs: Iterable<string>): string[] {
  const have = new Set(serviceSlugs);
  return CANONICAL_CONCERNS.filter((c) =>
    c.serviceSlugs.some((s) => have.has(s))
  ).map((c) => c.slug);
}
