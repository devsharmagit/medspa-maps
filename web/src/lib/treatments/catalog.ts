/**
 * catalog.ts — editorial extras for the 15 Phase-0 priority treatments.
 *
 * The canonical treatment list + core editorial copy live in
 * src/lib/taxonomy/canonical.ts (CANONICAL_SERVICES). This file adds the
 * at-a-glance pricing and recovery fields that aren't part of the canonical
 * record. scripts/reconcile-taxonomy.ts applies these (matched on `slug`) when
 * seeding the `services` table, and recomputes hero_rating/hero_review_count.
 *
 * Every slug here MUST exist in CANONICAL_SERVICES.
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
    aliases: ["tox", "botulinum", "neuromodulator"],
    summary:
      "Smooths dynamic wrinkles by relaxing the facial muscles responsible for fine lines.",
    description:
      "Botox and other neuromodulators are non-surgical injectables that temporarily relax targeted facial muscles to soften the appearance of fine lines and wrinkles. They are most commonly used on forehead lines, frown lines, and crow's feet while preserving natural, expressive movement.",
    price_from: 12,
    price_unit: "Unit",
    treatment_time: "20-30 mins",
    results_timeline: "Within 1 week",
    results_duration: "3-4 Months",
    recovery_time: "None",
  },
  {
    slug: "dermal-fillers",
    name: "Dermal Fillers",
    aliases: ["filler", "fillers", "hyaluronic acid", "juvederm", "restylane", "sculptra", "radiesse"],
    summary:
      "Restores lost volume and smooths folds using injectable hyaluronic acid and volumizing gels.",
    description:
      "Dermal fillers are injectable gels, most often hyaluronic acid based, used to restore lost facial volume, smooth deep folds, and refine the contours of the cheeks, lips, under-eyes, and jawline. Collagen-stimulating options such as Sculptra and Radiesse deliver gradual, longer-lasting volume restoration without surgery.",
    price_from: 650,
    price_unit: "Syringe",
    treatment_time: "30-45 mins",
    results_timeline: "Immediately",
    results_duration: "6-18 Months",
    recovery_time: "1-2 days",
  },
  {
    slug: "kybella",
    name: "Kybella",
    aliases: ["kybella", "liquid lipo", "deoxycholic acid", "double chin"],
    summary:
      "An injectable that permanently dissolves fat under the chin without surgery.",
    description:
      "Kybella is an FDA-approved injectable that uses synthetic deoxycholic acid to permanently destroy fat cells beneath the chin. Over a series of sessions it reduces the appearance of a double chin to reveal a more defined, contoured jawline without surgery.",
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
    aliases: ["pdo threads", "thread lift", "threads", "pdo"],
    summary:
      "Dissolvable sutures that lift loose skin and stimulate new collagen.",
    description:
      "PDO threads are dissolvable polydioxanone sutures placed beneath the skin to lift and tighten sagging areas while stimulating natural collagen production. This minimally invasive treatment offers an immediate, subtle lift with gradual, long-lasting firming of the face and neck.",
    price_from: 500,
    price_unit: "Area",
    treatment_time: "45-60 mins",
    results_timeline: "Immediately",
    results_duration: "12-18 Months",
    recovery_time: "3-7 days",
  },
  {
    slug: "prp-prf",
    name: "PRP (Platelet-Rich Plasma)",
    aliases: ["prp", "prf", "platelet rich plasma", "vampire facial"],
    summary:
      "Uses the body's own platelets to rejuvenate skin, restore volume, and boost healing.",
    description:
      "PRP and PRF concentrate the growth factors in your own blood to stimulate collagen, improve skin texture and tone, and support natural healing. Commonly used for facial rejuvenation, under-eye revitalization, and hair restoration with little downtime.",
    price_from: 650,
    price_unit: "Session",
    treatment_time: "45-60 mins",
    results_timeline: "3-6 weeks",
    results_duration: "6-12 Months",
    recovery_time: "1-2 days",
  },
  {
    slug: "microneedling",
    name: "Microneedling",
    aliases: ["micro-needling", "collagen induction", "skinpen", "rf microneedling", "morpheus8"],
    summary:
      "Stimulates collagen with fine micro-channels to refine skin texture, scars, and tone.",
    description:
      "Microneedling uses fine needles to create controlled micro-channels in the skin, triggering natural collagen and elastin production. RF microneedling platforms such as Morpheus8 and Sylfirm X add radiofrequency heat to remodel deeper tissue. Over a series of sessions it improves texture, fine lines, acne scarring, and overall radiance with little downtime.",
    price_from: 300,
    price_unit: "Session",
    treatment_time: "45-60 mins",
    results_timeline: "1-2 weeks",
    results_duration: "6-12 Months",
    recovery_time: "1-3 days",
  },
  {
    slug: "chemical-peels",
    name: "Chemical Peels",
    aliases: ["chemical peel", "peel", "peels", "vi peel"],
    summary:
      "Resurfaces dull, damaged skin with exfoliating acid solutions for a fresh glow.",
    description:
      "Chemical peels use medical-grade acid solutions to exfoliate the outermost layers of skin, revealing smoother, brighter, more even-toned skin underneath. Available from light to deep formulations, they target fine lines, sun damage, acne, and hyperpigmentation with customizable downtime.",
    price_from: 150,
    price_unit: "Treatment",
    treatment_time: "30-45 mins",
    results_timeline: "3-7 days",
    results_duration: "1-3 Months",
    recovery_time: "1-7 days",
  },
  {
    slug: "hydrafacial",
    name: "HydraFacial",
    aliases: ["hydra facial", "facial", "facials", "medical facial"],
    summary:
      "A medical-grade facial that cleanses, exfoliates, extracts, and hydrates in one session.",
    description:
      "HydraFacial is a multi-step, medical-grade facial that cleanses, gently exfoliates, extracts impurities, and infuses the skin with hydrating serums and antioxidants. It improves tone, clarity, and radiance with no downtime, making it a popular maintenance treatment for nearly every skin type.",
    price_from: 175,
    price_unit: "Session",
    treatment_time: "30-45 mins",
    results_timeline: "Immediately",
    results_duration: "2-4 Weeks",
    recovery_time: "None",
  },
  {
    slug: "rf-skin-tightening",
    name: "RF Skin Tightening",
    aliases: ["skin tightening", "radiofrequency skin tightening", "thermage", "exilis"],
    summary:
      "Radiofrequency energy that firms and lifts lax skin without surgery or needles.",
    description:
      "RF skin tightening uses radiofrequency energy to heat the deeper layers of the skin, contracting existing collagen and stimulating new collagen production. Devices such as Thermage and Exilis gradually firm and lift lax skin on the face, neck, and body with little to no downtime.",
    price_from: 600,
    price_unit: "Treatment",
    treatment_time: "30-60 mins",
    results_timeline: "3-6 weeks",
    results_duration: "1-2 Years",
    recovery_time: "None",
  },
  {
    slug: "ultherapy",
    name: "Ultherapy",
    aliases: ["ulthera", "ultrasound skin tightening", "sofwave", "hifu"],
    summary:
      "Focused ultrasound that lifts and tightens the skin from deep within, non-surgically.",
    description:
      "Ultherapy uses micro-focused ultrasound energy to reach the deep foundational layers of the skin, stimulating collagen to lift and tighten the brow, neck, and under-chin. As the only FDA-cleared ultrasound lift, it delivers gradual, natural-looking firming over two to three months with no downtime.",
    price_from: 1500,
    price_unit: "Treatment",
    treatment_time: "30-90 mins",
    results_timeline: "2-3 months",
    results_duration: "1-2 Years",
    recovery_time: "None",
  },
  {
    slug: "laser-skin-resurfacing",
    name: "Laser Skin Resurfacing",
    aliases: ["laser resurfacing", "co2 laser", "fractional laser", "halo"],
    summary:
      "Resurfaces and rejuvenates skin with laser energy to smooth texture, tone, and lines.",
    description:
      "Laser skin resurfacing uses precisely controlled laser energy to remove damaged surface skin and stimulate collagen in the layers beneath. It improves fine lines, sun damage, scarring, and uneven texture, revealing smoother, brighter, more youthful skin over a tailored treatment course.",
    price_from: 750,
    price_unit: "Treatment",
    treatment_time: "30-60 mins",
    results_timeline: "1-2 weeks",
    results_duration: "1-3 Years",
    recovery_time: "3-7 days",
  },
  {
    slug: "laser-hair-removal",
    name: "Laser Hair Removal",
    aliases: ["lhr", "laser hair", "hair removal"],
    summary:
      "Targets hair follicles with light energy for long-lasting, smooth skin.",
    description:
      "Laser hair removal uses concentrated light energy to target and disable hair follicles, progressively reducing unwanted hair growth. Performed over a series of sessions, it delivers long-lasting smoothness on the face and body with minimal discomfort and no downtime.",
    price_from: 99,
    price_unit: "Session",
    treatment_time: "15-60 mins",
    results_timeline: "After 2-3 sessions",
    results_duration: "Long-term",
    recovery_time: "None",
  },
  {
    slug: "ipl-photofacial",
    name: "IPL / Photofacial",
    aliases: ["ipl", "photofacial", "bbl", "intense pulsed light"],
    summary:
      "Pulsed light that clears sun spots, redness, and uneven tone for clearer skin.",
    description:
      "IPL photofacials use broadband intense pulsed light to target pigment and visible blood vessels, fading sun spots, redness, and uneven tone while boosting overall clarity. A series of quick, no-downtime sessions leaves the skin brighter and more even.",
    price_from: 350,
    price_unit: "Session",
    treatment_time: "20-40 mins",
    results_timeline: "1-2 weeks",
    results_duration: "6-12 Months",
    recovery_time: "None",
  },
  {
    slug: "coolsculpting",
    name: "CoolSculpting",
    aliases: ["cool sculpting", "cryolipolysis", "fat freezing"],
    summary:
      "Freezes and permanently eliminates stubborn fat without surgery or downtime.",
    description:
      "CoolSculpting (cryolipolysis) uses controlled cooling to freeze and permanently destroy stubborn fat cells in areas that resist diet and exercise, such as the abdomen, flanks, and under the chin. The body naturally clears the treated cells over the following weeks for a more contoured shape with no surgery or downtime.",
    price_from: 750,
    price_unit: "Treatment",
    treatment_time: "35-60 mins",
    results_timeline: "1-3 months",
    results_duration: "Long-term",
    recovery_time: "None",
  },
  {
    slug: "body-contouring",
    name: "Body Contouring",
    aliases: ["body sculpting", "emsculpt", "trusculpt", "fat reduction"],
    summary:
      "Non-surgical contouring that reduces fat and tones muscle to refine body shape.",
    description:
      "Body contouring treatments target stubborn fat and lax tissue while toning underlying muscle to refine the contours of the abdomen, flanks, arms, and more. Non-surgical platforms such as EmSculpt and truSculpt reduce fat and build muscle definition with little to no downtime.",
    price_from: 800,
    price_unit: "Session",
    treatment_time: "30-60 mins",
    results_timeline: "3-12 weeks",
    results_duration: "Long-term",
    recovery_time: "None",
  },
];
