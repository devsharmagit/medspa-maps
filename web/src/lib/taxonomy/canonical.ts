/**
 * canonical.ts — curated canonical service taxonomy + alias map + matcher.
 *
 * Source of truth for the *clean* public list of medspa treatments. Messy,
 * inconsistent scraped service names (with ®/™, brand variants, marketing
 * phrasing) are mapped onto this curated set via the alias map below and the
 * matchService() resolver.
 *
 * Seeded into the `services` (and `concerns`) tables by
 * scripts/seed-canonical.ts. Each CANONICAL_SERVICES entry UPSERTs into
 * `services` (ON CONFLICT (slug)). Aliases are stored as a TEXT[] column.
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
  /** service-name keywords used to link scraped services to this concern */
  serviceKeywords: string[];
}

/**
 * CANONICAL_SERVICES — the clean public catalog.
 *
 * Aliases (lowercased, ®/™ stripped) collectively cover every one of the 56
 * current messy scraped names so each resolves to exactly one canonical slug.
 */
export const CANONICAL_SERVICES: CanonicalService[] = [
  // ── Injectables ──────────────────────────────────────────────────────────
  {
    name: "Botox",
    slug: "botox",
    category: "Injectables",
    aliases: ["tox", "botox", "botulinum", "botulinum toxin", "onabotulinumtoxina", "wrinkle relaxer"],
    summary:
      "Smooths dynamic wrinkles by relaxing the facial muscles responsible for fine lines.",
    description:
      "Botox is a non-surgical injectable that temporarily relaxes targeted facial muscles to soften the appearance of fine lines and wrinkles. It is most commonly used on forehead lines, frown lines, and crow's feet while preserving natural, expressive movement.",
    treatment_time: "20-30 mins",
    results_timeline: "Within 1 week",
    results_duration: "3-4 Months",
    is_published: true,
  },
  {
    name: "Dysport",
    slug: "dysport",
    category: "Injectables",
    aliases: ["dysport", "abobotulinumtoxin", "abobotulinumtoxina"],
    summary:
      "A fast-acting neuromodulator that softens frown lines and other dynamic wrinkles.",
    description:
      "Dysport is a non-surgical injectable neuromodulator that temporarily relaxes the muscles that cause moderate to severe frown lines and other dynamic wrinkles. Known for its smooth, natural diffusion, it is often favored for larger areas such as the forehead while preserving authentic expression.",
    treatment_time: "20-30 mins",
    results_timeline: "2-3 days",
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
      "hyaluronic acid",
      "juvederm",
      "restylane",
      "skinvive",
      "dermal fillers & biostimulators",
      "dermal fillers and biostimulators",
      "liquid bbl",
      "renuva",
      "full facial balancing",
      "facial balancing",
    ],
    summary:
      "Restores lost volume and smooths folds using injectable hyaluronic acid and volumizing gels.",
    description:
      "Dermal fillers are injectable gels, most often hyaluronic acid based, used to restore lost facial volume, smooth deep folds, and refine the contours of the cheeks, lips, jawline, and beyond. Treatments such as full facial balancing and volumizing approaches deliver immediate, customizable results without surgery.",
    treatment_time: "30-45 mins",
    results_timeline: "Immediately",
    results_duration: "6-18 Months",
    is_published: true,
  },
  {
    name: "Sculptra & Radiesse",
    slug: "sculptra-radiesse",
    category: "Injectables",
    aliases: [
      "sculptra & radiesse",
      "sculptra and radiesse",
      "sculptra",
      "radiesse",
      "biostimulator",
      "biostimulators",
      "poly-l-lactic acid",
      "collagen stimulator",
    ],
    summary:
      "Collagen-stimulating injectables that gradually restore volume and firmness.",
    description:
      "Sculptra and Radiesse are injectable biostimulators that work with the body to rebuild lost collagen, restoring volume and firmness over time. Unlike traditional fillers, they deliver subtle, progressive improvement in facial fullness and skin quality that can last up to two years.",
    treatment_time: "30-45 mins",
    results_timeline: "4-6 weeks",
    results_duration: "Up to 2 Years",
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
      "double chin",
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
    aliases: ["pdo threads", "pdo thread", "thread lift", "thread lifts", "threads", "pdo"],
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
    name: "Regenerative Aesthetics (PRP/PRF)",
    slug: "prp-prf",
    category: "Injectables",
    aliases: [
      "regenerative aesthetics (prp/prf)",
      "regenerative aesthetics",
      "prp",
      "prf",
      "prp/prf",
      "platelet rich plasma",
      "platelet-rich plasma",
      "platelet rich fibrin",
    ],
    summary:
      "Uses the body's own platelets to rejuvenate skin, restore volume, and boost healing.",
    description:
      "Regenerative aesthetics with PRP and PRF concentrate the growth factors in your own blood to stimulate collagen, improve skin texture and tone, and support natural healing. Commonly used for facial rejuvenation, under-eye revitalization, and hair restoration with little downtime.",
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
    aliases: ["microneedling", "micro-needling", "micro needling", "collagen induction", "skinpen"],
    summary:
      "Stimulates collagen with fine micro-channels to refine skin texture and tone.",
    description:
      "Microneedling is a minimally invasive treatment that uses fine needles to create controlled micro-channels in the skin, triggering natural collagen and elastin production. Over a series of sessions it improves texture, fine lines, acne scarring, and overall radiance with little downtime.",
    treatment_time: "45-60 mins",
    results_timeline: "1-2 weeks",
    results_duration: "6-12 Months",
    is_published: true,
  },
  {
    name: "RF Microneedling",
    slug: "rf-microneedling",
    category: "Skin",
    aliases: [
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
      "ruma gold microchannel treatment",
      "ruma gold microchannel",
      "ruma gold",
    ],
    summary:
      "Combines microneedling with radiofrequency energy to tighten and remodel deeper tissue.",
    description:
      "RF microneedling delivers radiofrequency heat deep into the dermis through fine needles to remodel collagen and tighten skin. Platforms such as Morpheus8 and Sylfirm X address laxity, wrinkles, scarring, and uneven texture on the face and body, producing firmer, smoother skin with minimal downtime.",
    treatment_time: "45-60 mins",
    results_timeline: "3-4 weeks",
    results_duration: "1-3 Years",
    is_published: true,
  },
  {
    name: "Chemical Peels",
    slug: "chemical-peels",
    category: "Skin",
    aliases: ["chemical peels", "chemical peel", "peel", "peels"],
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
    name: "Facial Treatments",
    slug: "facial-treatments",
    category: "Skin",
    aliases: ["facial treatments", "facial treatment", "facial", "facials", "hydrafacial", "medical facial"],
    summary:
      "Customized medical-grade facials that cleanse, exfoliate, and rejuvenate the skin.",
    description:
      "Facial treatments are customized, medical-grade skincare sessions that cleanse, exfoliate, extract, and hydrate the skin to improve tone, clarity, and radiance. Tailored to each patient's concerns, they support overall skin health with relaxing, no-downtime care.",
    treatment_time: "45-60 mins",
    results_timeline: "Immediately",
    results_duration: "2-4 Weeks",
    is_published: true,
  },
  {
    name: "Skin Tightening",
    slug: "skin-tightening",
    category: "Skin",
    aliases: [
      "skin tightening",
      "everesse skin tightening",
      "everesse",
      "xerf",
      "skin firming",
      "non-surgical skin tightening",
    ],
    summary:
      "Energy-based treatments that firm and lift lax skin without surgery.",
    description:
      "Skin tightening treatments use focused energy to heat the deeper layers of the skin, contracting existing collagen and stimulating new collagen production. The result is gradual firming and lifting of lax skin on the face, neck, and body with little to no downtime.",
    treatment_time: "30-60 mins",
    results_timeline: "3-6 weeks",
    results_duration: "1-2 Years",
    is_published: true,
  },
  {
    name: "Medical-Grade Skincare",
    slug: "medical-grade-skincare",
    category: "Skin",
    aliases: ["medical-grade skincare", "medical grade skincare", "medical skincare", "skincare", "skin care"],
    summary:
      "Professional-strength skincare products and regimens prescribed for real results.",
    description:
      "Medical-grade skincare uses higher concentrations of clinically proven active ingredients than over-the-counter products, prescribed and tailored by a provider. A personalized regimen supports skin health and amplifies and maintains the results of in-office treatments.",
    treatment_time: "Consultation",
    results_timeline: "4-12 weeks",
    results_duration: "Ongoing",
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
      "laser peels",
      "laser peel",
      "laser treatments",
      "laser treatment",
      "laser skin treatments",
      "laser skin treatment",
      "nightlase",
      "endolift",
      "fractional laser",
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
    aliases: ["laser hair removal", "lhr", "laser hair", "hair removal"],
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
    name: "Tattoo Removal",
    slug: "tattoo-removal",
    category: "Laser",
    aliases: ["tattoo removal", "laser tattoo removal", "ink removal"],
    summary:
      "Laser energy breaks down ink particles to gradually fade unwanted tattoos.",
    description:
      "Laser tattoo removal uses targeted, high-intensity light pulses to shatter tattoo ink into tiny particles that the body naturally clears over time. Performed across multiple sessions, it progressively fades unwanted tattoos of varying colors and sizes with minimal risk to surrounding skin.",
    treatment_time: "15-30 mins",
    results_timeline: "After several sessions",
    results_duration: "Permanent",
    is_published: true,
  },

  // ── Body ─────────────────────────────────────────────────────────────────
  {
    name: "Medical Weight Loss",
    slug: "medical-weight-loss",
    category: "Body",
    aliases: [
      "medical weight loss",
      "medical weight loss program",
      "weight loss",
      "weight loss program",
      "semaglutide",
      "tirzepatide",
      "glp-1",
    ],
    summary:
      "Physician-supervised weight loss plans combining medication, nutrition, and support.",
    description:
      "Medical weight loss is a physician-supervised program that combines prescription medications, nutrition guidance, and ongoing monitoring to help patients lose weight safely and sustainably. Plans are tailored to each individual's health profile and goals.",
    treatment_time: "Ongoing program",
    results_timeline: "Weeks to months",
    results_duration: "Long-term with maintenance",
    is_published: true,
  },
  {
    name: "Body Sculpting",
    slug: "body-sculpting",
    category: "Body",
    aliases: ["body sculpting", "body contouring", "fat reduction"],
    summary:
      "Non-surgical contouring that reduces stubborn fat and refines body shape.",
    description:
      "Body sculpting treatments target stubborn pockets of fat and lax tissue that resist diet and exercise, refining the contours of the abdomen, flanks, arms, and more. Non-surgical approaches reduce fat and tighten skin with little to no downtime.",
    treatment_time: "30-60 mins",
    results_timeline: "3-12 weeks",
    results_duration: "Long-term",
    is_published: true,
  },
  {
    name: "MiraDry",
    slug: "miradry",
    category: "Body",
    aliases: ["miradry", "mira dry", "sweat reduction", "hyperhidrosis treatment"],
    summary:
      "A non-invasive treatment that permanently reduces underarm sweat and odor.",
    description:
      "MiraDry is a non-invasive, FDA-cleared treatment that uses targeted electromagnetic energy to permanently eliminate underarm sweat and odor glands. Most patients see a dramatic, lasting reduction in sweat after one or two sessions with minimal downtime.",
    treatment_time: "45-60 mins",
    results_timeline: "Immediately",
    results_duration: "Permanent",
    is_published: true,
  },

  // ── Hair ─────────────────────────────────────────────────────────────────
  {
    name: "Hair Restoration",
    slug: "hair-restoration",
    category: "Hair",
    aliases: ["hair restoration", "hair loss treatment", "hair regrowth", "prp hair restoration"],
    summary:
      "Treatments that stimulate dormant follicles to restore thicker, fuller hair.",
    description:
      "Hair restoration treatments use regenerative therapies such as PRP, along with prescription protocols, to stimulate dormant follicles and slow hair loss. A personalized plan supports thicker, fuller, healthier hair growth over a series of sessions.",
    treatment_time: "45-60 mins",
    results_timeline: "3-6 months",
    results_duration: "Ongoing with maintenance",
    is_published: true,
  },

  // ── Wellness ───────────────────────────────────────────────────────────
  {
    name: "Hormone Therapy",
    slug: "hormone-therapy",
    category: "Wellness",
    aliases: ["hormone therapy", "hrt", "bhrt", "bioidentical hormone", "hormone replacement", "hormone optimization"],
    summary:
      "Restores hormonal balance to improve energy, mood, sleep, and overall vitality.",
    description:
      "Hormone therapy restores balance to declining or imbalanced hormones using personalized, physician-supervised protocols. By optimizing levels, it can improve energy, mood, sleep, libido, and overall well-being for both men and women.",
    treatment_time: "Consultation + ongoing",
    results_timeline: "2-6 weeks",
    results_duration: "Ongoing with maintenance",
    is_published: true,
  },
  {
    name: "IV Therapy",
    slug: "iv-therapy",
    category: "Wellness",
    aliases: [
      "iv therapy",
      "iv hydration",
      "vitamin iv therapy",
      "vitamin iv",
      "iv drip",
      "hydration therapy",
      "iv vitamin therapy",
    ],
    summary:
      "Delivers fluids, vitamins, and nutrients directly into the bloodstream for fast replenishment.",
    description:
      "IV therapy delivers a customized blend of fluids, electrolytes, vitamins, and antioxidants directly into the bloodstream for rapid absorption. It supports hydration, energy, immunity, recovery, and overall wellness, with effects felt quickly and no recovery time required.",
    treatment_time: "30-60 mins",
    results_timeline: "Within hours",
    results_duration: "Several days",
    is_published: true,
  },
  {
    name: "Peptide Therapy",
    slug: "peptide-therapy",
    category: "Wellness",
    aliases: ["peptide therapy", "peptides", "peptide", "peptide injections"],
    summary:
      "Targeted peptides that support recovery, performance, and healthy aging.",
    description:
      "Peptide therapy uses short chains of amino acids to signal specific functions in the body, supporting recovery, metabolism, immune health, and healthy aging. Protocols are personalized and physician-supervised to align with each patient's wellness goals.",
    treatment_time: "Consultation + ongoing",
    results_timeline: "2-8 weeks",
    results_duration: "Ongoing with maintenance",
    is_published: true,
  },
  {
    name: "Biological Age Testing",
    slug: "biological-age-testing",
    category: "Wellness",
    aliases: ["biological age testing", "biological age", "epigenetic age testing", "longevity testing"],
    summary:
      "Advanced testing that measures how your body is aging at the cellular level.",
    description:
      "Biological age testing analyzes biomarkers to estimate how your body is aging at the cellular level, independent of your chronological age. The insights guide personalized longevity and wellness plans aimed at slowing the aging process.",
    treatment_time: "Sample collection",
    results_timeline: "1-3 weeks for results",
    results_duration: "Baseline + retesting",
    is_published: true,
  },
  {
    name: "DEXA Body Scan",
    slug: "dexa-body-scan",
    category: "Wellness",
    aliases: ["dexa body scan", "dexa scan", "dexa", "body composition scan", "dxa scan"],
    summary:
      "A precise scan measuring body fat, lean mass, and bone density.",
    description:
      "A DEXA body scan uses low-dose imaging to precisely measure body fat, lean muscle mass, and bone density. The detailed breakdown provides a baseline for fitness, weight management, and longevity goals and tracks progress over time.",
    treatment_time: "10-20 mins",
    results_timeline: "Same day",
    results_duration: "Baseline + retesting",
    is_published: true,
  },
  {
    name: "Multi-Cancer Early Detection Screening",
    slug: "multi-cancer-early-detection-screening",
    category: "Wellness",
    aliases: [
      "multi-cancer early detection screening",
      "multi cancer early detection screening",
      "multi-cancer early detection",
      "cancer screening",
      "early cancer detection",
    ],
    summary:
      "A blood-based screening that looks for early signals of multiple cancers.",
    description:
      "Multi-cancer early detection screening is a blood test that looks for shared signals associated with many types of cancer, often before symptoms appear. It complements standard screenings to support earlier detection and proactive care.",
    treatment_time: "Blood draw",
    results_timeline: "1-3 weeks for results",
    results_duration: "Annual screening",
    is_published: true,
  },
  {
    name: "EBOO / Ozone Therapy",
    slug: "eboo-ozone-therapy",
    category: "Wellness",
    aliases: [
      "eboo / ozone therapy",
      "eboo/ozone therapy",
      "eboo & ozone therapy",
      "eboo and ozone therapy",
      "eboo",
      "ozone therapy",
      "ozone",
    ],
    summary:
      "Blood ozonation and filtration therapy aimed at detoxification and circulation.",
    description:
      "EBOO (extracorporeal blood oxygenation and ozonation) and ozone therapy filter and oxygenate the blood with the goal of supporting circulation, detoxification, immune function, and inflammation. Sessions are physician-supervised and tailored to wellness goals.",
    treatment_time: "60-90 mins",
    results_timeline: "After several sessions",
    results_duration: "Ongoing with maintenance",
    is_published: true,
  },
  {
    name: "Gut Health & Allergy Testing",
    slug: "gut-health-allergy-testing",
    category: "Wellness",
    aliases: [
      "gut health / allergy testing",
      "gut health allergy testing",
      "gut health and allergy testing",
      "gut health",
      "allergy testing",
      "food sensitivity testing",
    ],
    summary:
      "Comprehensive testing to uncover gut imbalances and allergy or sensitivity triggers.",
    description:
      "Gut health and allergy testing analyze the microbiome and immune responses to identify imbalances, sensitivities, and triggers behind digestion, inflammation, and overall wellness issues. Results guide a personalized nutrition and treatment plan.",
    treatment_time: "Sample collection",
    results_timeline: "1-3 weeks for results",
    results_duration: "Baseline + retesting",
    is_published: true,
  },
  {
    name: "NeuroWellness",
    slug: "neurowellness",
    category: "Wellness",
    aliases: ["neurowellness", "neuro wellness", "exomind", "cognitive wellness", "brain health"],
    summary:
      "Treatments supporting mental clarity, mood, focus, and cognitive resilience.",
    description:
      "NeuroWellness encompasses treatments such as Exomind that support brain health, mood, focus, and mental resilience through non-invasive neuromodulation and targeted protocols. Care is personalized to help patients feel sharper and more balanced.",
    treatment_time: "20-45 mins",
    results_timeline: "After several sessions",
    results_duration: "Ongoing with maintenance",
    is_published: true,
  },
  {
    name: "Regenerative & Joint Therapy",
    slug: "regenerative-joint-therapy",
    category: "Wellness",
    aliases: [
      "regenerative medicine / joint therapy",
      "regenerative medicine joint therapy",
      "regenerative medicine",
      "joint therapy",
      "joint injections",
      "regenerative joint therapy",
    ],
    summary:
      "Regenerative treatments that relieve joint pain and support healing without surgery.",
    description:
      "Regenerative medicine and joint therapy use the body's own healing capacity through treatments such as PRP and biologic injections to relieve joint pain, reduce inflammation, and support tissue repair. These non-surgical options target the underlying source of discomfort.",
    treatment_time: "30-60 mins",
    results_timeline: "2-6 weeks",
    results_duration: "Long-lasting",
    is_published: true,
  },
  {
    name: "Cosmetic Dentistry",
    slug: "cosmetic-dentistry",
    category: "Wellness",
    aliases: ["cosmetic dentistry", "teeth whitening", "smile makeover", "veneers"],
    summary:
      "Treatments that enhance the appearance of your smile, teeth, and gums.",
    description:
      "Cosmetic dentistry improves the look of your smile through treatments such as whitening, veneers, and contouring. A tailored plan addresses color, shape, and alignment to create a brighter, more confident smile.",
    treatment_time: "30-90 mins",
    results_timeline: "Immediately to weeks",
    results_duration: "Years",
    is_published: true,
  },

  // ── Women's & Men's Health ────────────────────────────────────────────────
  {
    name: "Women's Health",
    slug: "womens-health",
    category: "Wellness",
    aliases: ["women's health", "womens health", "women health", "feminine wellness"],
    summary:
      "Personalized wellness care addressing women's hormonal, sexual, and intimate health.",
    description:
      "Women's health services provide personalized, physician-supervised care for hormonal balance, sexual wellness, intimate health, and overall vitality. Treatments are tailored to each stage of life to help women feel their best.",
    treatment_time: "Consultation + treatment",
    results_timeline: "Varies by treatment",
    results_duration: "Ongoing with maintenance",
    is_published: true,
  },
  {
    name: "Men's Sexual Health",
    slug: "mens-sexual-health",
    category: "Wellness",
    aliases: ["men's sexual health", "mens sexual health", "men sexual health", "ed treatment", "erectile dysfunction treatment"],
    summary:
      "Discreet, physician-supervised treatments for men's sexual wellness and vitality.",
    description:
      "Men's sexual health services offer discreet, physician-supervised treatments for erectile function, performance, and overall vitality. Options including regenerative therapies and hormone optimization are tailored to restore confidence and wellness.",
    treatment_time: "Consultation + treatment",
    results_timeline: "Varies by treatment",
    results_duration: "Ongoing with maintenance",
    is_published: true,
  },
  {
    name: "Vaginal Rejuvenation",
    slug: "vaginal-rejuvenation",
    category: "Wellness",
    aliases: [
      "vaginal tightening",
      "vaginal rejuvenation",
      "incontilase",
      "prolaplase",
      "lichenlase",
      "feminine rejuvenation",
      "vaginal laser",
    ],
    summary:
      "Non-surgical laser treatments addressing intimate laxity, incontinence, and comfort.",
    description:
      "Vaginal rejuvenation uses gentle, non-surgical laser treatments to address intimate laxity, mild incontinence, dryness, and related discomfort. Protocols such as IncontiLase and ProlapLase stimulate collagen to restore comfort and function with no downtime.",
    treatment_time: "20-30 mins",
    results_timeline: "After 1-3 sessions",
    results_duration: "12-18 Months",
    is_published: true,
  },
];

/**
 * CANONICAL_CONCERNS — reuse of the 7 existing concerns (see
 * src/lib/concerns/catalog.ts). serviceKeywords mirror the catalog so scraped
 * services can be linked to the concerns they treat.
 */
export const CANONICAL_CONCERNS: CanonicalConcern[] = [
  {
    name: "Fine Lines & Wrinkles",
    slug: "fine-lines-wrinkles",
    aliases: ["wrinkle", "fine line", "anti-aging", "anti aging", "botox", "tox", "dysport", "xeomin", "filler", "facial balancing", "thread", "pdo"],
    serviceKeywords: ["tox", "botox", "dysport", "xeomin", "filler", "biostimulator", "facial balancing", "thread", "pdo", "endolift", "rf microneedling", "microneedling"],
  },
  {
    name: "Acne & Acne Scars",
    slug: "acne-acne-scars",
    aliases: ["acne", "scar", "chemical peel", "microneedling", "skinpen", "laser peel", "rf microneedling", "facial"],
    serviceKeywords: ["chemical peel", "laser peel", "microneedling", "skinpen", "rf microneedling", "facial treatment", "prp", "prf"],
  },
  {
    name: "Volume Loss & Facial Hollows",
    slug: "volume-loss-facial-hollows",
    aliases: ["filler", "volume", "cheek", "lip", "facial balancing", "biostimulator", "sculptra", "restylane", "juvederm", "bbl"],
    serviceKeywords: ["filler", "biostimulator", "facial balancing", "liquid bbl", "restylane", "juvederm", "sculptra", "skinvive", "radiesse", "renuva"],
  },
  {
    name: "Sun Damage & Pigmentation",
    slug: "sun-damage-pigmentation",
    aliases: ["pigment", "sun damage", "dark spot", "melasma", "hyperpigment", "chemical peel", "laser peel", "ipl", "photofacial", "bbl"],
    serviceKeywords: ["chemical peel", "laser peel", "laser skin", "ipl", "photofacial", "peel", "skincare", "sylfirm"],
  },
  {
    name: "Skin Laxity & Sagging",
    slug: "skin-laxity-sagging",
    aliases: ["laxity", "sagging", "tighten", "lift", "rf microneedling", "endolift", "thread", "pdo", "nightlase", "tightening"],
    serviceKeywords: ["rf microneedling", "endolift", "thread", "pdo", "nightlase", "skin tightening", "everesse", "morpheus", "sculptra", "microneedling"],
  },
  {
    name: "Unwanted Hair",
    slug: "unwanted-hair",
    aliases: ["hair removal", "laser hair", "unwanted hair"],
    serviceKeywords: ["laser hair removal", "hair removal"],
  },
  {
    name: "Double Chin & Submental Fullness",
    slug: "double-chin-submental-fullness",
    aliases: ["kybella", "double chin", "submental", "chin fat"],
    serviceKeywords: ["kybella", "liquid lipo"],
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
