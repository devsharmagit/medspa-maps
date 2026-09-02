import type { LandingContent } from "./types";

/**
 * Condition landing-page content registry (→ /condition/[slug]).
 * Copy transcribed from `pages-docs/CONDITION-*.docx`. Phase 1: Wrinkles,
 * Pigmentation, Veins. Images are local Adobe Stock photos under
 * `/public/images/landing/`; sections without an assigned image render
 * full-width, which is expected.
 */

const wrinkles: LandingContent = {
  kind: "condition",
  slug: "wrinkles",
  title: "Wrinkles: Causes, Treatments, and How to Find a Provider",
  shortName: "Wrinkles",
  metaTitle: "Wrinkles: Causes, Treatments & How to Find a Provider | Med Spa Maps",
  metaDescription:
    "What causes wrinkles, the types, which medspa treatments help, how to prevent them, and how to find and compare providers who treat wrinkles near you.",
  updated: "August 2026",
  datePublishedISO: "2026-08-21",
  dateModifiedISO: "2026-08-21",
  hero: {
    src: "/images/landing/AdobeStock_1966544880.jpeg",
    alt: "A woman examining the fine lines around her eyes in a mirror",
  },
  atGlance: [
    "Wrinkles are lines and creases that form as skin loses collagen, elastin, and volume with age and sun exposure.",
    "There are two main kinds: dynamic wrinkles from repeated movement, and static wrinkles present even at rest.",
    "Botox is best for dynamic lines; dermal fillers restore volume for static lines; resurfacing (laser, microneedling, peels) improves texture.",
    "Daily sun protection and a good skincare routine are the foundation of prevention.",
    "The best treatment depends on the type and depth of your wrinkles, so a consultation matters.",
    "Use Med Spa Maps to find and compare providers who treat wrinkles near you.",
  ],
  sections: [
    {
      id: "what-causes-wrinkles",
      heading: "What causes",
      headingAccent: "wrinkles?",
      body: [
        "Wrinkles form as the skin gradually loses collagen, elastin, and volume, and as repeated facial movements crease the skin over time. Sun exposure is one of the biggest accelerators, along with genetics, smoking, and lifestyle factors.",
        "Two forces are usually at work: intrinsic aging, the natural slowdown of collagen production, and extrinsic aging, mostly from UV exposure (often called photoaging). Together they thin the skin and reduce its ability to bounce back, so lines settle in and deepen.",
      ],
      image: {
        src: "/images/landing/AdobeStock_237489024.jpeg",
        alt: "Close-up of a forehead showing fine lines and wrinkles",
      },
    },
    {
      id: "types-of-wrinkles",
      heading: "What are the types of",
      headingAccent: "wrinkles?",
      body: [
        "Wrinkles fall into two broad categories: dynamic wrinkles, which appear when you make expressions, and static wrinkles, which are visible even when your face is at rest. Knowing which you have points to the right treatment.",
      ],
      table: {
        headers: ["Type", "When they show", "Common examples", "Best-suited treatments"],
        rows: [
          ["Dynamic", "With movement", "Frown lines, forehead lines, crow's feet", "Botox and other neuromodulators"],
          ["Static", "At rest", "Nasolabial folds, deep creases, volume loss", "Dermal fillers, resurfacing"],
        ],
      },
      pullQuote:
        "Dynamic wrinkles appear when your face moves and respond to Botox; static wrinkles are visible at rest and are usually softened with fillers or resurfacing.",
    },
    {
      id: "treatments-for-wrinkles",
      heading: "What medspa treatments help with",
      headingAccent: "wrinkles?",
      body: [
        "The most common professional options are Botox for movement lines, dermal fillers for volume and static lines, and resurfacing treatments like laser, microneedling, and chemical peels for texture and fine lines. The right plan often combines more than one.",
      ],
      bullets: [
        "Botox and neuromodulators: relax the muscles that cause frown lines, forehead lines, and crow's feet.",
        "Dermal fillers: restore lost volume and soften deeper static folds.",
        "Laser resurfacing: remodels the skin's surface to smooth lines and texture.",
        "Microneedling: stimulates collagen to improve fine lines and tone.",
        "Chemical peels: exfoliate to improve surface texture and fine lines.",
        "Skin tightening (RF and others): address mild laxity that can accompany wrinkles.",
      ],
      image: {
        src: "/images/landing/AdobeStock_499147015.jpeg",
        alt: "A provider injecting a wrinkle-relaxing treatment into a patient's forehead",
      },
    },
    {
      id: "which-treatment",
      heading: "Which wrinkle treatment is right for",
      headingAccent: "me?",
      body: [
        "It depends on where your wrinkles are and whether they appear with movement or at rest. Movement lines on the upper face usually point to Botox, volume loss and deep folds to fillers, and overall texture or fine lines to resurfacing.",
        "Most people benefit from a personalized combination, and a qualified provider can map your concerns to the right treatments and sequence. For a deeper look at injectables and lasers, our treatment guides cover each option in detail.",
      ],
    },
    {
      id: "prevent-wrinkles",
      heading: "Can you prevent",
      headingAccent: "wrinkles?",
      body: [
        "You can slow their development significantly. Daily broad-spectrum sunscreen is the single most effective step, since UV exposure is a leading cause of premature wrinkles.",
      ],
      bullets: [
        "Wear broad-spectrum SPF 30+ every day and reapply.",
        "Use proven ingredients like retinoids and antioxidants, as advised by a professional.",
        "Avoid smoking and limit sun exposure.",
        "Keep skin hydrated and maintain a consistent routine.",
      ],
      image: {
        src: "/images/landing/AdobeStock_2003352575.jpeg",
        alt: "Sunscreen, sunglasses, and a sun hat, daily habits that help prevent wrinkles",
      },
    },
  ],
  provider: {
    intro: [
      "Because most wrinkle treatments are medical procedures, look for a licensed medical professional with injectable or device training, a natural-looking portfolio, and a consultation-first approach that matches treatments to your specific wrinkles.",
    ],
    tips: [
      "Credentials: a physician, PA, NP, or supervised RN for injectables and lasers.",
      "A tailored plan: they assess your face and recommend a combination, not a single default.",
      "Natural results: before-and-after photos that look balanced.",
      "Skin-type experience: important for lasers and resurfacing.",
      "Reviews: consistent, credible feedback.",
    ],
  },
  faqs: [
    {
      q: "How do you get rid of forehead wrinkles?",
      a: "Forehead lines that appear with movement respond well to Botox and other neuromodulators, while deeper lines present at rest may also benefit from dermal filler or resurfacing. Daily sunscreen and a retinoid can help prevent them from deepening. A provider can recommend the right combination.",
    },
    {
      q: "What is the best treatment for wrinkles?",
      a: "There is no single best treatment; it depends on the type and depth of the wrinkle. Botox is best for dynamic (movement) lines, fillers restore volume and soften static lines, and resurfacing treatments like laser, microneedling, and peels improve texture. Many people combine approaches.",
    },
    {
      q: "Can wrinkles be reversed?",
      a: "Existing wrinkles can often be softened significantly, though results vary and are usually maintained rather than permanent. Early, consistent care and professional treatment tend to produce the best improvement.",
    },
    {
      q: "Should I get Botox or filler for wrinkles?",
      a: "Botox relaxes the muscles that cause expression lines, while filler adds volume to smooth static lines and restore fullness. The right choice depends on your specific wrinkles, and the two are often used together.",
    },
    {
      q: "How can I prevent wrinkles?",
      a: "The most effective prevention is daily broad-spectrum sunscreen, since sun exposure is a leading cause of premature wrinkles. A good skincare routine, not smoking, and managing sun exposure all help.",
    },
    {
      q: "At what age do wrinkles start?",
      a: "Fine lines often begin to appear in the late twenties to thirties as collagen production slows, though timing varies widely based on genetics, sun exposure, and lifestyle.",
    },
  ],
  searchCta: {
    label: "Find wrinkle-treatment providers near you",
    href: "/search?condition=fine-lines-wrinkles",
  },
  schemaAbout: { type: "MedicalCondition", name: "Wrinkles (facial rhytides)" },
};

const pigmentation: LandingContent = {
  kind: "condition",
  slug: "pigmentation",
  title: "Pigmentation and Dark Spots: Causes, Treatments, and How to Find a Provider",
  shortName: "Pigmentation",
  metaTitle: "Pigmentation & Dark Spots: Causes, Treatments & How to Find a Provider | Med Spa Maps",
  metaDescription:
    "What causes hyperpigmentation, the types, which medspa treatments fade dark spots, safety for darker skin tones, and how to find providers near you.",
  updated: "August 2026",
  datePublishedISO: "2026-08-21",
  dateModifiedISO: "2026-08-21",
  hero: {
    src: "/images/landing/AdobeStock_2067210186.jpeg",
    alt: "A woman examining areas of pigmentation on her cheek",
  },
  atGlance: [
    "Hyperpigmentation is darkened patches of skin caused by excess melanin, usually from sun, inflammation, or hormones.",
    "The most common types are sun/age spots, post-inflammatory hyperpigmentation (PIH), and melasma.",
    "Professional treatments include chemical peels, laser and IPL, microneedling, and prescription topicals.",
    "Melasma and deeper skin tones need extra caution, since aggressive treatments can worsen pigment.",
    "Daily sun protection is essential to fade spots and keep them from returning.",
    "Use Med Spa Maps to find and compare providers who treat pigmentation near you.",
  ],
  sections: [
    {
      id: "what-is-pigmentation",
      heading: "What is",
      headingAccent: "hyperpigmentation?",
      body: [
        "Hyperpigmentation is a common, usually harmless condition where patches of skin become darker than the surrounding area due to excess melanin. It appears as spots, patches, or broad discoloration, most often on sun-exposed areas like the face, hands, and chest.",
        "While most pigmentation is a cosmetic concern, any new, changing, itching, or bleeding spot should be checked by a dermatologist to rule out something more serious.",
      ],
      pullQuote:
        "Not all dark spots are the same. Sunspots, post-inflammatory marks, and melasma respond to different treatments, so identifying the type comes first.",
    },
    {
      id: "what-causes-pigmentation",
      heading: "What causes",
      headingAccent: "pigmentation and dark spots?",
      body: [
        "Pigmentation is driven mainly by sun exposure, skin inflammation or injury, and hormonal changes. Medications and genetics can also contribute.",
      ],
      bullets: [
        "Sun exposure: UV light stimulates melanin, producing sunspots and worsening most pigmentation.",
        "Inflammation or injury: acne, eczema, and procedures can leave post-inflammatory dark marks.",
        "Hormones: pregnancy and hormone changes can trigger melasma.",
      ],
      image: {
        src: "/images/landing/AdobeStock_794885489.jpeg",
        alt: "A woman shielding her face from the sun, a common trigger for dark spots",
      },
    },
    {
      id: "types-of-pigmentation",
      heading: "What are the types of",
      headingAccent: "pigmentation?",
      body: [
        "The three most common types are sunspots (or age spots), post-inflammatory hyperpigmentation, and melasma. They differ in cause, depth, and how they respond to treatment.",
      ],
      table: {
        headers: ["Type", "Typical cause", "Outlook"],
        rows: [
          ["Sun / age spots", "Cumulative UV exposure", "Responds well"],
          ["Post-inflammatory (PIH)", "Acne, injury, inflammation", "Fades over time; treatable"],
          ["Melasma", "Hormones plus sun", "Manageable; prone to recurrence"],
        ],
      },
    },
    {
      id: "treatments-for-pigmentation",
      heading: "What medspa treatments work on",
      headingAccent: "pigmentation?",
      body: [
        "The most effective professional options are chemical peels, laser and IPL, microneedling, and prescription-strength topicals. The right one depends on the type of pigmentation, its depth, and your skin tone, and providers often combine treatments.",
      ],
      bullets: [
        "Chemical peels: exfoliate pigmented surface cells to brighten tone.",
        "Laser and IPL: target pigment; effective but require caution, and not first-line for melasma.",
        "Microneedling: boosts turnover and is often safer across skin tones.",
        "Prescription topicals: ingredients like hydroquinone, tretinoin, and vitamin C, often a first step.",
      ],
      image: {
        src: "/images/landing/AdobeStock_1022983802.jpeg",
        alt: "An esthetician applying a chemical peel to treat pigmentation",
      },
    },
    {
      id: "pigmentation-darker-skin-tones",
      heading: "Is pigmentation treatment safe for",
      headingAccent: "darker skin tones?",
      body: [
        "Yes, but the choice of treatment is critical. Deeper skin tones have more active melanin, so aggressive lasers and IPL can sometimes trigger more pigment. Gentler, melanin-safe options in experienced hands are often the smarter starting point.",
        "Safer approaches for richer skin tones often include microneedling, superficial peels, prescription topicals, and specific laser wavelengths used at conservative settings. The most important safeguard is a provider experienced in treating skin of color.",
      ],
      image: {
        src: "/images/landing/AdobeStock_1497677194.jpeg",
        alt: "A woman with a deeper skin tone and a clear, even complexion",
      },
    },
  ],
  provider: {
    intro: [
      "Look for a licensed professional who can correctly identify your type of pigmentation, has experience with your skin tone, and offers the appropriate mix of treatments rather than a single option.",
    ],
    tips: [
      "Accurate diagnosis: they identify the type of pigmentation before treating it.",
      "Skin-of-color experience: essential for safe, effective treatment in deeper tones.",
      "A range of options: peels, devices, and topicals, matched to your skin.",
      "Medical oversight: important for prescription treatments and lasers.",
      "Reviews: consistent, credible results.",
    ],
  },
  faqs: [
    {
      q: "What causes skin pigmentation and dark spots?",
      a: "Excess pigmentation is caused by overproduction of melanin, usually triggered by sun exposure, inflammation or injury (such as acne), or hormones. Certain medications and genetics can also play a role.",
    },
    {
      q: "What is the best treatment for pigmentation?",
      a: "It depends on the type and depth of the pigmentation and your skin tone. Options include chemical peels, laser and IPL, microneedling, and prescription topicals. Melasma and deeper skin tones need gentler, carefully chosen approaches.",
    },
    {
      q: "Can pigmentation be removed permanently?",
      a: "Many dark spots can be significantly improved, but results vary and pigmentation can return, especially with sun exposure. Ongoing sun protection and maintenance are key to keeping skin clear.",
    },
    {
      q: "Is pigmentation treatment safe for darker skin tones?",
      a: "Yes, with the right approach. Deeper skin tones have more active melanin, so aggressive lasers and IPL can sometimes worsen pigment. Gentler, melanin-safe options in experienced hands are often the smarter starting point.",
    },
    {
      q: "How long does it take for dark spots to fade?",
      a: "Most people see gradual improvement over several weeks to a few months, depending on the treatment and the depth of the pigment. Consistency and daily sunscreen make a big difference.",
    },
    {
      q: "How do I prevent pigmentation from coming back?",
      a: "Daily broad-spectrum sunscreen is the most important step, along with treating acne and irritation early and avoiding picking at the skin. A maintenance routine helps keep results.",
    },
  ],
  searchCta: {
    label: "Find pigmentation providers near you",
    href: "/search?condition=hyperpigmentation",
  },
  schemaAbout: { type: "MedicalCondition", name: "Hyperpigmentation (skin discoloration)" },
};

const veins: LandingContent = {
  kind: "condition",
  slug: "veins",
  title: "Varicose and Spider Veins: Causes, Treatments, and How to Find a Provider",
  shortName: "Veins",
  metaTitle: "Varicose & Spider Veins: Causes, Treatments & How to Find a Provider | Med Spa Maps",
  metaDescription:
    "What causes varicose and spider veins, how they differ, available treatments, when veins are a medical issue, and how to find providers near you.",
  updated: "August 2026",
  datePublishedISO: "2026-08-21",
  dateModifiedISO: "2026-08-21",
  hero: {
    src: "/images/landing/AdobeStock_2003406279.jpeg",
    alt: "A doctor examining a patient's visible leg veins during a consultation",
  },
  atGlance: [
    "Spider veins and varicose veins are enlarged, visible veins, most often on the legs.",
    "Spider veins are small and usually cosmetic; varicose veins are larger, raised, and can cause aching or heaviness.",
    "Common treatments include sclerotherapy and laser for spider veins; larger varicose veins may need a vein specialist.",
    "Persistent pain, swelling, or skin changes should be evaluated by a medical provider, as varicose veins can signal an underlying vein condition.",
    "Compression stockings and lifestyle measures can help manage symptoms.",
    "Use Med Spa Maps to find and compare vein treatment providers near you.",
  ],
  sections: [
    {
      id: "what-causes-veins",
      heading: "What causes",
      headingAccent: "varicose and spider veins?",
      body: [
        "Varicose and spider veins form when the tiny one-way valves inside veins weaken or fail, allowing blood to pool and the veins to enlarge and become visible near the skin’s surface. The legs are most commonly affected because they bear the most pressure.",
        "Common risk factors include family history, age, pregnancy, hormonal changes, prolonged standing or sitting, and carrying extra weight. Women are affected more often than men.",
      ],
      image: {
        src: "/images/landing/AdobeStock_233683543.jpeg",
        alt: "Close-up of visible spider veins on the back of a leg",
      },
    },
    {
      id: "spider-vs-varicose-veins",
      heading: "Spider veins vs. varicose veins: what’s the",
      headingAccent: "difference?",
      body: [
        "Spider veins are small, thin, red or blue web-like veins near the surface and are usually a cosmetic concern. Varicose veins are larger, raised, and rope-like, and can cause symptoms like aching, heaviness, throbbing, or swelling.",
        "Because varicose veins can sometimes reflect a medical vein condition, symptoms like pain, swelling, or skin changes deserve evaluation by a vein specialist rather than treatment as a purely cosmetic issue.",
      ],
      pullQuote:
        "Spider veins are small and usually cosmetic, while varicose veins are larger and can cause aching or heaviness that may point to an underlying vein condition.",
    },
    {
      id: "vein-treatments",
      heading: "What treatments are available for",
      headingAccent: "veins?",
      body: [
        "For cosmetic spider veins, the most common treatments are sclerotherapy and laser vein treatment. Larger varicose veins and symptomatic veins are treated by vein specialists with procedures such as endovenous laser or radiofrequency ablation.",
        "A qualified provider will confirm which type of veins you have and whether your case is cosmetic or medical before recommending treatment.",
      ],
      bullets: [
        "Sclerotherapy: a solution is injected into spider or small varicose veins, causing them to close and fade.",
        "Laser vein treatment: targeted light closes small surface veins, often used on tiny spider veins.",
        "Endovenous ablation: a minimally invasive procedure for larger varicose veins, done by a vein specialist.",
        "Compression and lifestyle: stockings, movement, and leg elevation help manage symptoms.",
      ],
      image: {
        src: "/images/landing/AdobeStock_1725222801.jpeg",
        alt: "A sclerotherapy injection treating spider veins on the leg",
      },
    },
    {
      id: "veins-medical-issue",
      heading: "When are veins a",
      headingAccent: "medical issue?",
      body: [
        "Veins become a medical concern, not just a cosmetic one, when they cause symptoms such as persistent aching, heaviness, swelling, cramping, skin discoloration, or open sores. These can indicate an underlying vein condition that needs medical evaluation.",
        "If you have these symptoms, a vein specialist (a phlebologist or vascular physician) can assess circulation and recommend appropriate treatment, which may differ from cosmetic vein care.",
      ],
    },
  ],
  provider: {
    intro: [
      "For cosmetic spider veins, look for a licensed medical provider experienced in sclerotherapy or laser vein treatment. For larger or symptomatic varicose veins, choose a board-certified vein specialist or vascular physician.",
    ],
    tips: [
      "The right specialist: a vein specialist for varicose or symptomatic veins; a qualified provider for cosmetic spider veins.",
      "Proper evaluation: they assess whether your veins are cosmetic or medical before treating.",
      "Experience: a track record with the specific treatment you need.",
      "Clear expectations: they explain that results build over time and may need more than one session.",
      "Reviews: consistent, credible feedback.",
    ],
  },
  faqs: [
    {
      q: "What causes varicose and spider veins?",
      a: "They form when the small valves inside veins weaken, allowing blood to pool and the veins to enlarge and become visible. Risk factors include genetics, age, pregnancy, prolonged standing, and being overweight.",
    },
    {
      q: "Are spider veins the same as varicose veins?",
      a: "No. Spider veins are small, thin, web-like veins near the skin’s surface and are usually a cosmetic concern. Varicose veins are larger, raised, and rope-like, and can cause aching, heaviness, or swelling, sometimes signaling an underlying vein condition.",
    },
    {
      q: "Can a medspa treat veins?",
      a: "Many medspas treat cosmetic spider veins with sclerotherapy or laser. Larger varicose veins and any veins causing pain or swelling are best evaluated by a vein specialist (a phlebologist or vascular doctor), since they may indicate a medical condition.",
    },
    {
      q: "Does sclerotherapy work for spider veins?",
      a: "Sclerotherapy is a well-established treatment for spider veins and small varicose veins. A solution is injected into the vein, causing it to close and fade over time. Most people need more than one session, and results vary.",
    },
    {
      q: "Is vein treatment covered by insurance?",
      a: "Purely cosmetic vein treatment is usually not covered, while treatment for medically necessary varicose veins that cause symptoms sometimes is. Coverage depends on your plan and diagnosis, so check with your provider and insurer.",
    },
    {
      q: "How can I prevent varicose and spider veins?",
      a: "You cannot always prevent them, but staying active, maintaining a healthy weight, elevating your legs, avoiding long periods of standing or sitting, and wearing compression stockings can help reduce risk and ease symptoms.",
    },
  ],
  searchCta: {
    label: "Find vein-treatment providers near you",
    href: "/search?condition=spider-veins",
  },
  searchAliases: { conditions: ["spider-veins", "varicose-veins"] },
  schemaAbout: { type: "MedicalCondition", name: "Varicose veins and spider veins" },
};

export const CONDITION_PAGES: Record<string, LandingContent> = {
  wrinkles,
  pigmentation,
  veins,
};

export function getConditionPage(slug: string): LandingContent | null {
  return CONDITION_PAGES[slug] ?? null;
}

export function allConditionSlugs(): string[] {
  return Object.keys(CONDITION_PAGES);
}
