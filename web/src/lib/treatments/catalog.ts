/**
 * catalog.ts — editorial treatment catalog
 *
 * Source of truth for the marketing copy and at-a-glance stats shown on
 * treatment editorial pages. Seeded into the `services` table by
 * scripts/seed-treatments.ts (matched on `slug`).
 *
 * Copy is medically accurate, marketing-toned, and aimed at prospective
 * patients researching non-surgical aesthetic treatments.
 */

export interface TreatmentCatalogEntry {
  slug: string;
  name: string;
  aliases: string[];
  summary: string;
  description: string;
  price_from: number;
  price_unit: string;
  treatment_time: string;
  results_timeline: string;
  results_duration: string;
  recovery_time: string;
}

export const TREATMENT_CATALOG: TreatmentCatalogEntry[] = [
  {
    slug: "botox",
    name: "Botox",
    aliases: ["tox", "botulinum"],
    summary:
      "Smooths dynamic wrinkles by relaxing the facial muscles responsible for fine lines.",
    description:
      "Botox is a non-surgical injectable treatment that temporarily relaxes targeted facial muscles to reduce the appearance of fine lines and wrinkles. It is commonly used to treat forehead lines, frown lines, and crow's feet while helping maintain a natural, refreshed appearance.",
    price_from: 129,
    price_unit: "Unit",
    treatment_time: "20-30 mins",
    results_timeline: "Within 1 day",
    results_duration: "4-6 Months",
    recovery_time: "None",
  },
  {
    slug: "dysport",
    name: "Dysport",
    aliases: ["dysport", "abobotulinumtoxin", "tox"],
    summary:
      "A fast-acting neuromodulator that softens frown lines and other dynamic wrinkles.",
    description:
      "Dysport is a non-surgical injectable neuromodulator that temporarily relaxes the muscles that cause moderate to severe frown lines and other dynamic wrinkles. Known for its smooth, natural-looking diffusion, Dysport is often favored for treating larger areas such as the forehead while preserving authentic facial expression.",
    price_from: 4,
    price_unit: "Unit",
    treatment_time: "20-30 mins",
    results_timeline: "2-3 days",
    results_duration: "3-4 Months",
    recovery_time: "None",
  },
  {
    slug: "dermal-fillers",
    name: "Dermal Fillers",
    aliases: ["filler", "fillers", "hyaluronic acid", "hyaluronic-acid", "juvederm", "restylane"],
    summary:
      "Restores lost volume and smooths folds using injectable hyaluronic acid gels.",
    description:
      "Dermal fillers are injectable gels, most commonly formulated with hyaluronic acid, used to restore lost facial volume, smooth deep folds, and enhance contours of the cheeks, lips, and jawline. The treatment delivers immediate, customizable results for a fuller, more youthful appearance without surgery.",
    price_from: 650,
    price_unit: "Syringe",
    treatment_time: "30-45 mins",
    results_timeline: "Immediately",
    results_duration: "6-18 Months",
    recovery_time: "1-2 days",
  },
  {
    slug: "kybella-liquid-lipo",
    name: "Kybella & Liquid Lipo",
    aliases: ["kybella", "liquid lipo", "liquid-lipo", "deoxycholic acid", "double chin"],
    summary:
      "Dissolves stubborn fat beneath the chin and small areas without surgery.",
    description:
      "Kybella and liquid lipo are non-surgical injectable treatments that permanently destroy unwanted fat cells in stubborn areas such as the submental region beneath the chin. Using deoxycholic acid, the treatment gradually reduces fullness to sculpt a more defined, contoured profile over a series of sessions.",
    price_from: 600,
    price_unit: "Treatment",
    treatment_time: "30-45 mins",
    results_timeline: "4-6 weeks",
    results_duration: "Permanent",
    recovery_time: "3-5 days",
  },
  {
    slug: "laser-hair-removal",
    name: "Laser Hair Removal",
    aliases: ["lhr", "laser hair", "laser-hair", "hair removal"],
    summary:
      "Targets hair follicles with light energy for long-lasting, smooth skin.",
    description:
      "Laser hair removal is a non-invasive treatment that uses concentrated light energy to target and disable hair follicles, progressively reducing unwanted hair growth. Performed over a series of sessions, it delivers long-lasting smoothness on the face and body with minimal discomfort and no downtime.",
    price_from: 99,
    price_unit: "Session",
    treatment_time: "15-60 mins",
    results_timeline: "After 2-3 sessions",
    results_duration: "Long-term",
    recovery_time: "None",
  },
  {
    slug: "microneedling",
    name: "Microneedling",
    aliases: ["micro-needling", "collagen induction", "skinpen"],
    summary:
      "Stimulates collagen with fine micro-channels to refine skin texture and tone.",
    description:
      "Microneedling is a minimally invasive treatment that uses fine needles to create controlled micro-channels in the skin, triggering the body's natural collagen and elastin production. Over a series of sessions it improves skin texture, fine lines, acne scarring, and overall radiance with little downtime.",
    price_from: 300,
    price_unit: "Session",
    treatment_time: "45-60 mins",
    results_timeline: "1-2 weeks",
    results_duration: "6-12 Months",
    recovery_time: "1-3 days",
  },
  {
    slug: "morpheus8",
    name: "Morpheus8",
    aliases: ["morpheus", "morpheus 8", "rf microneedling", "rf-microneedling"],
    summary:
      "Combines microneedling with radiofrequency to tighten and remodel deeper tissue.",
    description:
      "Morpheus8 is a fractional radiofrequency microneedling treatment that delivers heat energy deep into the dermis to remodel collagen and tighten skin. It addresses laxity, wrinkles, and uneven texture on the face and body, producing firmer, smoother skin with minimal downtime.",
    price_from: 800,
    price_unit: "Treatment",
    treatment_time: "45-60 mins",
    results_timeline: "3-4 weeks",
    results_duration: "1-3 Years",
    recovery_time: "2-4 days",
  },
  {
    slug: "chemical-peels",
    name: "Chemical Peels",
    aliases: ["chemical peel", "peel", "peels"],
    summary:
      "Resurfaces dull, damaged skin with exfoliating acid solutions for a fresh glow.",
    description:
      "Chemical peels use medical-grade acid solutions to exfoliate the outermost layers of skin, revealing smoother, brighter, and more even-toned skin underneath. Available in light to deep formulations, they target fine lines, sun damage, acne, and hyperpigmentation with customizable downtime.",
    price_from: 150,
    price_unit: "Treatment",
    treatment_time: "30-45 mins",
    results_timeline: "3-7 days",
    results_duration: "1-3 Months",
    recovery_time: "1-7 days",
  },
  {
    slug: "pdo-thread-lifts",
    name: "PDO Thread Lifts",
    aliases: ["pdo threads", "pdo-threads", "thread lift", "thread-lift", "threads"],
    summary:
      "Lifts and tightens sagging skin with dissolvable sutures that boost collagen.",
    description:
      "PDO thread lifts are a minimally invasive alternative to surgical facelifts that use dissolvable polydioxanone sutures to lift and reposition sagging skin. The threads provide an immediate subtle lift while stimulating long-term collagen production for firmer, rejuvenated contours.",
    price_from: 500,
    price_unit: "Area",
    treatment_time: "45-60 mins",
    results_timeline: "Immediately",
    results_duration: "12-18 Months",
    recovery_time: "3-7 days",
  },
  {
    slug: "sculptra-radiesse",
    name: "Sculptra & Radiesse",
    aliases: ["sculptra", "radiesse", "biostimulator", "biostimulators", "poly-l-lactic acid", "collagen stimulator"],
    summary:
      "Collagen-stimulating injectables that gradually restore volume and firmness.",
    description:
      "Sculptra and Radiesse are injectable biostimulators that work with the body to gradually rebuild lost collagen, restoring volume and firmness over time. Unlike traditional fillers, they deliver subtle, progressive improvement in facial fullness and skin quality that can last up to two years.",
    price_from: 750,
    price_unit: "Syringe",
    treatment_time: "30-45 mins",
    results_timeline: "4-6 weeks",
    results_duration: "Up to 2 Years",
    recovery_time: "1-2 days",
  },
  {
    slug: "facial-treatments",
    name: "Facial Treatments",
    aliases: ["facial", "facials", "hydrafacial", "medical facial"],
    summary:
      "Customized medical-grade facials that cleanse, exfoliate, and rejuvenate the skin.",
    description:
      "Facial treatments are customized, medical-grade skincare sessions that cleanse, exfoliate, extract, and hydrate the skin to improve tone, clarity, and radiance. Tailored to each patient's concerns, they support overall skin health with relaxing, no-downtime care.",
    price_from: 125,
    price_unit: "Session",
    treatment_time: "45-60 mins",
    results_timeline: "Immediately",
    results_duration: "2-4 Weeks",
    recovery_time: "None",
  },
  {
    slug: "kybella",
    name: "Kybella",
    aliases: ["kybella", "deoxycholic acid", "double chin"],
    summary:
      "An injectable that permanently dissolves fat under the chin without surgery.",
    description:
      "Kybella is an FDA-approved injectable treatment that uses synthetic deoxycholic acid to permanently destroy fat cells beneath the chin. Over a series of sessions, it reduces the appearance of a double chin to reveal a more defined and contoured jawline without surgery.",
    price_from: 600,
    price_unit: "Treatment",
    treatment_time: "20-30 mins",
    results_timeline: "4-6 weeks",
    results_duration: "Permanent",
    recovery_time: "3-5 days",
  },
  {
    slug: "pdo-threads",
    name: "PDO Threads",
    aliases: ["pdo thread lifts", "pdo-thread-lifts", "thread lift", "thread-lift", "threads"],
    summary:
      "Dissolvable sutures that lift loose skin and stimulate new collagen.",
    description:
      "PDO threads are dissolvable polydioxanone sutures placed beneath the skin to lift and tighten sagging areas while stimulating natural collagen production. This minimally invasive treatment offers an immediate subtle lift with gradual, long-lasting firming of the face and neck.",
    price_from: 500,
    price_unit: "Area",
    treatment_time: "45-60 mins",
    results_timeline: "Immediately",
    results_duration: "12-18 Months",
    recovery_time: "3-7 days",
  },
  {
    slug: "tox",
    name: "Tox",
    aliases: ["botox", "dysport", "botulinum", "neuromodulator", "wrinkle relaxer"],
    summary:
      "Neuromodulator injections that relax muscles to smooth expression lines.",
    description:
      "Tox refers to injectable neuromodulators such as Botox and Dysport that temporarily relax targeted facial muscles to soften dynamic wrinkles. Quick and virtually painless, these treatments smooth forehead lines, frown lines, and crow's feet for a refreshed, natural-looking result.",
    price_from: 12,
    price_unit: "Unit",
    treatment_time: "20-30 mins",
    results_timeline: "Within 1 week",
    results_duration: "3-4 Months",
    recovery_time: "None",
  },
  {
    slug: "tattoo-removal",
    name: "Tattoo Removal",
    aliases: ["laser tattoo removal", "tattoo-removal", "ink removal"],
    summary:
      "Laser energy breaks down ink particles to gradually fade unwanted tattoos.",
    description:
      "Laser tattoo removal uses targeted, high-intensity light pulses to break down tattoo ink into tiny particles that the body naturally clears over time. Performed across multiple sessions, it progressively fades unwanted tattoos of varying colors and sizes with minimal risk to the surrounding skin.",
    price_from: 150,
    price_unit: "Session",
    treatment_time: "15-30 mins",
    results_timeline: "After several sessions",
    results_duration: "Permanent",
    recovery_time: "7-14 days",
  },
  {
    slug: "iv-hydration",
    name: "IV Hydration",
    aliases: ["iv therapy", "iv-therapy", "iv drip", "vitamin iv", "hydration therapy"],
    summary:
      "Delivers fluids, vitamins, and nutrients directly into the bloodstream for fast replenishment.",
    description:
      "IV hydration therapy delivers a customized blend of fluids, electrolytes, vitamins, and antioxidants directly into the bloodstream for rapid absorption. It supports hydration, energy, recovery, and overall wellness, with effects felt quickly and no recovery time required.",
    price_from: 150,
    price_unit: "Session",
    treatment_time: "30-60 mins",
    results_timeline: "Within hours",
    results_duration: "Several days",
    recovery_time: "None",
  },
];
