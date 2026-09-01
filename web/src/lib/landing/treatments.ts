import type { LandingContent } from "./types";
import { uns } from "./images";

/**
 * Treatment landing-page content registry (→ /treatment/[slug]).
 * Copy transcribed from `pages-docs/SERVICE-*.docx`. Phase 1: Botox.
 * Images are on-theme Unsplash photos (allow-listed) shown in alternating
 * left/right sections; swap any `src` for a client-supplied final later.
 */

const botox: LandingContent = {
  kind: "treatment",
  slug: "botox",
  title: "Botox: What It Is, What It Treats, and How to Find a Provider",
  shortName: "Botox",
  metaTitle: "Botox: What It Is, What It Treats & How to Find a Provider | Med Spa Maps",
  metaDescription:
    "What Botox is, what it treats, how long it lasts, safety, and how to find and compare licensed Botox providers near you.",
  updated: "August 2026",
  datePublishedISO: "2026-08-21",
  dateModifiedISO: "2026-08-21",
  hero: {
    src: uns("1512290923902-8a9f81dc236c", 1600),
    alt: "A licensed provider performing a Botox treatment on a relaxed patient",
  },
  atGlance: [
    "Botox is a purified botulinum toxin injection that temporarily relaxes the muscles behind expression lines like frown lines, forehead lines, and crow's feet.",
    "It is a quick, non-surgical treatment with little to no downtime; most sessions take about 10 to 20 minutes.",
    "Results typically appear within 3 to 7 days and last around 3 to 4 months.",
    "Botox, Dysport, Xeomin, and Jeuveau are all neuromodulators in the same family, used for similar concerns.",
    "It should only be administered by a licensed medical provider (a physician, PA, NP, or a supervised RN).",
    "Use Med Spa Maps to find and compare licensed Botox providers near you.",
  ],
  sections: [
    {
      id: "what-is-botox",
      heading: "What is",
      headingAccent: "Botox?",
      body: [
        "Botox is a purified form of botulinum toxin that temporarily relaxes specific facial muscles, softening the lines created when you frown, squint, or raise your eyebrows. It is the most widely recognized of several neuromodulator brands and is used both cosmetically and for certain medical conditions.",
        "Because it works on muscle movement rather than adding volume, Botox is best for dynamic wrinkles, which are the lines that appear when your face moves. It is a temporary treatment, so results fade gradually and are maintained with repeat sessions.",
      ],
      pullQuote:
        "Botox is a purified form of botulinum toxin that temporarily relaxes specific facial muscles, softening the lines created when you frown, squint, or raise your eyebrows.",
      image: { src: uns("1616394584738-fc6e612e71b9"), alt: "A relaxed patient during a facial aesthetic treatment" },
    },
    {
      id: "what-does-botox-treat",
      heading: "What does Botox",
      headingAccent: "treat?",
      body: [
        "Cosmetically, Botox is most commonly used for the frown lines between the brows, horizontal forehead lines, and crow's feet around the eyes. It also has a range of other cosmetic and medical uses.",
      ],
      bullets: [
        "Frown lines (glabella): the vertical “11” lines between the eyebrows.",
        "Forehead lines: the horizontal lines that appear when you raise your brows.",
        "Crow's feet: the fine lines that fan out from the corners of the eyes.",
        "Other cosmetic uses: a gummy smile, lip flip, jaw slimming (masseter), and neck bands.",
        "Medical uses: excessive sweating (hyperhidrosis), chronic migraine, and certain muscle conditions.",
      ],
      image: { src: uns("1487412947147-5cebf100ffc2"), alt: "Close-up of a face showing the areas Botox commonly treats" },
    },
    {
      id: "how-does-botox-work",
      heading: "How does Botox",
      headingAccent: "work?",
      body: [
        "Botox works by temporarily blocking the nerve signals that tell certain muscles to contract. When those muscles relax, the overlying skin smooths out, and the lines caused by repeated movement soften.",
        "The effect is localized to the small areas where it is injected, so a skilled injector can relax the muscles that cause wrinkles while preserving natural expression.",
      ],
      image: { src: uns("1633681926022-84c23e8cb2d6"), alt: "A modern med spa treatment room" },
    },
    {
      id: "how-long-does-botox-last",
      heading: "How long does Botox",
      headingAccent: "last?",
      body: [
        "Botox results typically last about three to four months. As the effect gradually wears off, muscle movement returns and lines reappear, which is why maintenance treatments are common.",
        "Everyone metabolizes Botox at a slightly different rate. First-timers sometimes see it fade a bit faster, and many people find results last longer with consistent treatment over time.",
      ],
    },
    {
      id: "how-much-does-botox-cost",
      heading: "How much does Botox",
      headingAccent: "cost?",
      body: [
        "Botox is usually priced either per unit or per treatment area, so your total depends on how many units you need, which areas are treated, and your provider and location. Because the right amount is personalized, a consultation is the best way to get an accurate quote.",
        "When comparing providers, remember that Botox is a medical treatment where the injector's skill matters a great deal, so the lowest price is not always the best value.",
      ],
      image: { src: uns("1596755094514-f87e34085b2c"), alt: "A patient consultation about treatment pricing" },
    },
    {
      id: "is-botox-safe",
      heading: "Is Botox safe? What are the",
      headingAccent: "side effects?",
      body: [
        "Botox is FDA-approved for several cosmetic and medical uses and is considered safe when administered by a trained, licensed medical provider. Most side effects are mild and temporary.",
        "Common side effects include minor bruising, swelling, or redness at the injection site, and occasionally a temporary headache. Rare issues such as eyelid or brow drooping are usually the result of injection technique and resolve on their own. Choosing an experienced, credentialed injector is the best way to reduce risk.",
      ],
      pullQuote:
        "Botox should only be injected by a licensed medical professional; the difference between a natural result and a frozen or uneven one usually comes down to the injector's skill.",
      image: { src: uns("1598300042247-d088f8ab3a91"), alt: "A clean, professional med spa clinic interior" },
    },
    {
      id: "botox-vs-alternatives",
      heading: "Botox vs. Dysport, Xeomin, and",
      headingAccent: "Jeuveau",
      body: [
        "Botox, Dysport, Xeomin, and Jeuveau are all neuromodulators made from botulinum toxin, and they treat the same kinds of expression lines. They differ slightly in formulation, how quickly they take effect, and how they spread, and a provider can help you choose.",
        "In practice, the choice often comes down to your provider's recommendation for your anatomy and goals rather than a meaningful difference in results.",
      ],
      image: { src: uns("1631730359585-38a4935cbec4"), alt: "Aesthetic treatment products on a clinical tray" },
    },
  ],
  provider: {
    intro: [
      "Because Botox is a medical treatment, look for a licensed medical professional (a physician, physician assistant, nurse practitioner, or a registered nurse working under medical supervision) with specific injectable training and a track record of natural-looking results.",
    ],
    tips: [
      "Credentials and oversight: confirm who performs the injections and that a medical provider is involved.",
      "Experience: ask how often they perform Botox and to see before-and-after photos.",
      "A real consultation: a good provider assesses your face, discusses goals, and sets realistic expectations.",
      "Clean, professional setting: treatment should take place in a medical or clinical environment.",
      "Reviews: look for consistent, credible feedback from other patients.",
    ],
  },
  faqs: [
    {
      q: "How long does Botox last?",
      a: "Botox results typically last about three to four months. First-time patients sometimes find results wear off a little sooner, and with regular treatment the effect can last longer over time. Your provider can recommend a maintenance schedule.",
    },
    {
      q: "How much does Botox cost?",
      a: "Botox is usually priced either per unit or per treatment area, so the total depends on how many units you need, the areas treated, and your provider and location. A consultation is the best way to get an accurate quote.",
    },
    {
      q: "Does Botox hurt?",
      a: "Most people feel only a quick pinch with each injection. The needles are very fine, treatment takes just a few minutes, and numbing is usually not needed, though some providers offer it.",
    },
    {
      q: "How soon will I see results from Botox?",
      a: "Botox usually starts working within three to five days, with full results visible in about one to two weeks as the treated muscles relax.",
    },
    {
      q: "Is Botox safe?",
      a: "Botox is FDA-approved for several cosmetic and medical uses and is considered safe when administered by a licensed medical provider. Side effects are usually mild and temporary, such as bruising or slight drooping, and serious complications are rare.",
    },
    {
      q: "How many units of Botox will I need?",
      a: "It varies by the area treated, your muscle strength, and your goals. A qualified injector determines the right number of units during your consultation rather than using a one-size-fits-all amount.",
    },
    {
      q: "Can you get Botox while pregnant?",
      a: "Botox is generally not recommended during pregnancy or breastfeeding because it has not been well studied in these groups. A provider will review your history and advise you during a consultation.",
    },
    {
      q: "What is the difference between Botox and filler?",
      a: "Botox relaxes the muscles that create expression lines, while dermal fillers add volume to plump lines and restore fullness. They treat different concerns and are often combined.",
    },
  ],
  searchCta: { label: "Find Botox providers near you", href: "/search?q=Botox" },
  schemaAbout: { type: "MedicalProcedure", name: "Botox (botulinum toxin) injection" },
};

export const TREATMENT_PAGES: Record<string, LandingContent> = {
  botox,
};

export function getTreatmentPage(slug: string): LandingContent | null {
  return TREATMENT_PAGES[slug] ?? null;
}

export function allTreatmentSlugs(): string[] {
  return Object.keys(TREATMENT_PAGES);
}
