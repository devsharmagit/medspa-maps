import type { LandingContent } from "./types";
import { uns } from "./images";

/**
 * Condition landing-page content registry (→ /condition/[slug]).
 * Copy transcribed from `pages-docs/CONDITION-*.docx`. Phase 1: Wrinkles.
 * Note: the URL slug ("wrinkles") is short; the search CTA still targets the
 * catalog concern slug ("fine-lines-wrinkles").
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
    src: uns("1616683693504-3ea7e9ad6fec", 1600),
    alt: "Close-up of healthy skin, the focus of wrinkle treatment",
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
      image: { src: uns("1502823403499-6ccfcf4fb453"), alt: "A face showing natural signs of aging skin" },
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
      image: { src: uns("1616394584738-fc6e612e71b9"), alt: "A professional facial resurfacing treatment" },
    },
    {
      id: "which-treatment",
      heading: "Which wrinkle treatment is right for",
      headingAccent: "me?",
      body: [
        "It depends on where your wrinkles are and whether they appear with movement or at rest. Movement lines on the upper face usually point to Botox, volume loss and deep folds to fillers, and overall texture or fine lines to resurfacing.",
        "Most people benefit from a personalized combination, and a qualified provider can map your concerns to the right treatments and sequence. For a deeper look at injectables and lasers, our treatment guides cover each option in detail.",
      ],
      image: { src: uns("1596755094514-f87e34085b2c"), alt: "A provider mapping a personalized treatment plan with a patient" },
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
      image: { src: uns("1540555700478-4be289fbecef"), alt: "Daily skincare and sun-protection products" },
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

export const CONDITION_PAGES: Record<string, LandingContent> = {
  wrinkles,
};

export function getConditionPage(slug: string): LandingContent | null {
  return CONDITION_PAGES[slug] ?? null;
}

export function allConditionSlugs(): string[] {
  return Object.keys(CONDITION_PAGES);
}
