/**
 * Blog post registry — the single source of truth for post METADATA (title,
 * description, dates, TL;DR takeaways, FAQ, CTA, hero image). The article BODY
 * lives separately as markdown in `src/content/blog/<slug>.md` and is read at
 * build time only (see ./index.ts `getPostBody`).
 *
 * Keeping metadata here (a plain, always-bundled TS module) lets the
 * force-dynamic homepage and the /blog index read it with no filesystem access,
 * while the fully-prerendered /blog/[slug] route is the only place that touches
 * the markdown files.
 *
 * To add the next SEO article: add one entry here + drop a `<slug>.md` body
 * file + a hero image under public/images/blog/. It then appears on /blog, in
 * the homepage "latest articles" cards, and the sitemap automatically.
 */

export interface BlogFaq {
  q: string;
  a: string;
}

export interface BlogCta {
  label: string;
  href: string;
}

export interface BlogImageCredit {
  name: string;
  url: string;
}

export interface BlogPostMeta {
  slug: string;
  title: string;
  /** Meta description — from the SEO team's supplied schema. */
  description: string;
  /** Short label shown on cards + as the article eyebrow. */
  category: string;
  author: string;
  /** ISO date (YYYY-MM-DD). */
  datePublished: string;
  /** ISO date (YYYY-MM-DD). */
  dateModified: string;
  readingMinutes: number;
  heroImage: string;
  heroAlt: string;
  heroCredit?: BlogImageCredit;
  /** TL;DR "Key Takeaways" box. */
  keyTakeaways: string[];
  /** Closing call-to-action into the directory. */
  cta: BlogCta;
  /** Powers both the on-page FAQ accordion and the FAQPage JSON-LD. */
  faqs: BlogFaq[];
}

export const BLOG_POSTS: BlogPostMeta[] = [
  {
    slug: "laser-skin-treatments-explained",
    title: "Laser Skin Treatments Decoded: IPL vs. BBL vs. Resurfacing vs. Genesis",
    description:
      "What IPL, BBL, fractional resurfacing, and Laser Genesis each do, what they treat, their downtime and cost, and how to pick the right one.",
    category: "Treatments",
    author: "Medspa Maps Editorial Team",
    datePublished: "2026-08-21",
    dateModified: "2026-08-21",
    readingMinutes: 7,
    heroImage: "/images/blog/laser-skin-treatments-explained-hero.jpeg",
    heroAlt: "A laser skin treatment being performed on a client's face at a med spa.",
    keyTakeaways: [
      "“Laser skin treatment” is an umbrella term for several very different technologies, and picking the right one depends on what you’re treating.",
      "IPL and BBL aren’t technically lasers (they’re intense pulsed light), and are best for redness, sun spots, and overall tone.",
      "Resurfacing lasers (ablative CO2/erbium and fractional like Fraxel) remodel the skin’s surface for wrinkles, texture, and scars, with more downtime.",
      "Non-ablative lasers like Laser Genesis work gently with little to no downtime, and are better for redness, fine lines, and maintenance.",
      "Downtime scales with intensity, from zero (IPL, Genesis) to a week or more (fully ablative CO2).",
      "Laser choice and settings matter enormously for darker skin tones, where the wrong device can cause burns or pigment changes, so provider expertise is critical.",
    ],
    cta: {
      label: "Find laser skin providers near you",
      href: "/search?q=laser-skin-resurfacing",
    },
    faqs: [
      {
        q: "Is IPL a laser?",
        a: "No. IPL (intense pulsed light) and BBL use broadband light rather than a single-wavelength laser beam. They are excellent for sun spots, redness, and overall tone, but they work differently from true lasers and treat somewhat different concerns.",
      },
      {
        q: "Which laser is best for sun spots and pigmentation?",
        a: "IPL and BBL are popular for sun spots and uneven tone on lighter skin, while pigment-specific lasers such as Q-switched and picosecond devices target stubborn pigment. The best choice depends on your pigmentation type and skin tone, so a provider assessment matters.",
      },
      {
        q: "How many sessions will I need?",
        a: "Gentler, non-ablative treatments like IPL and Laser Genesis are usually done in a series of 3 to 6 sessions, while a single ablative resurfacing treatment can deliver dramatic results in one or two sessions with more downtime.",
      },
      {
        q: "How much does laser resurfacing cost?",
        a: "Costs vary widely by device and depth. Lighter treatments like IPL or Laser Genesis are the most affordable, fractional resurfacing sits higher, and full ablative CO2 resurfacing is the most expensive. A consultation gives an accurate quote.",
      },
      {
        q: "Is laser skin treatment safe for dark skin?",
        a: "Some devices are, and some are not. Wavelength and settings are critical: certain lasers like Nd:YAG and conservative fractional settings can be safer for deeper skin tones, while aggressive IPL and ablative treatments carry more risk of burns or pigment change. Provider expertise is essential.",
      },
      {
        q: "How long is the downtime?",
        a: "Downtime scales with intensity, from essentially none for IPL and Laser Genesis, to a few days for fractional treatments, to a week or more for fully ablative CO2 resurfacing.",
      },
      {
        q: "Does laser skin treatment hurt?",
        a: "Most treatments cause a warm, snapping or prickling sensation. Numbing cream is commonly used, especially for more intensive resurfacing, so discomfort is usually manageable.",
      },
      {
        q: "How long do results last?",
        a: "It varies by treatment and concern. Resurfacing results can last for years with good sun protection, though no treatment stops ongoing aging; maintenance sessions and daily SPF help preserve results.",
      },
    ],
  },
  {
    slug: "hyperpigmentation-treatments",
    title: "Fading Hyperpigmentation: Which Medspa Treatments Actually Work on Dark Spots",
    description:
      "What causes hyperpigmentation and which professional treatments — lasers, peels, microneedling — fade dark spots, plus what’s safest for deeper skin tones.",
    category: "Skin care",
    author: "Medspa Maps Editorial Team",
    datePublished: "2026-08-21",
    dateModified: "2026-08-21",
    readingMinutes: 7,
    heroImage: "/images/blog/hyperpigmentation-treatments-hero.jpeg",
    heroAlt: "Close-up of skin with dark spots and uneven tone being assessed before treatment.",
    keyTakeaways: [
      "Hyperpigmentation is darkened patches of skin caused by excess melanin, usually from sun exposure, inflammation (acne, injury), or hormones (melasma).",
      "The three most common types are sun/age spots, post-inflammatory hyperpigmentation (PIH), and melasma, and they don’t all respond to the same treatments.",
      "Professional options include chemical peels, laser and IPL, microneedling, and prescription-strength topicals; the right choice depends on the type, depth, and your skin tone.",
      "Melasma and deeper skin tones need extra caution: aggressive lasers can worsen pigment, so gentler, melanin-safe approaches are often better.",
      "Most treatments take several weeks to a few months to show results, and daily SPF is non-negotiable to keep spots from returning.",
      "A licensed provider should confirm the type of pigmentation before treating it, and any new or changing spot should be checked to rule out something more serious.",
    ],
    cta: {
      label: "Find hyperpigmentation providers near you",
      href: "/search?condition=hyperpigmentation",
    },
    faqs: [
      {
        q: "What is the fastest way to fade dark spots?",
        a: "In-office treatments like chemical peels, lasers, and IPL generally work faster than at-home products, but “fast” still means weeks, not days. The best approach depends on the type of pigmentation, and daily sunscreen is essential to keep results from reversing.",
      },
      {
        q: "Can hyperpigmentation be permanent?",
        a: "Some hyperpigmentation fades on its own over months, especially post-inflammatory marks, while deeper or long-standing pigment can be stubborn. Most cases can be improved with the right treatment, though results vary and some conditions like melasma tend to recur.",
      },
      {
        q: "Does hyperpigmentation go away on its own?",
        a: "Post-inflammatory hyperpigmentation often fades gradually over several months without treatment, but sun exposure can prolong it. Sun spots and melasma usually need active treatment and sun protection to improve.",
      },
      {
        q: "Is laser or a chemical peel better for dark spots?",
        a: "It depends on the pigmentation type, its depth, and your skin tone. Peels are versatile and gentler; lasers can be more targeted but carry more risk in deeper skin tones. A provider matches the treatment to your specific situation.",
      },
      {
        q: "Is treatment safe for Black and brown skin?",
        a: "Yes, but device and technique choice are critical. Deeper skin tones have more active melanin, so aggressive lasers and IPL can sometimes worsen pigment. Gentler, melanin-safe options in the hands of an experienced provider are often the smarter starting point.",
      },
      {
        q: "Why does my hyperpigmentation keep coming back?",
        a: "Sun exposure is the most common reason pigmentation returns, and hormonal triggers can drive recurrence in melasma. Consistent daily SPF and maintenance care are key to keeping spots from reappearing.",
      },
      {
        q: "How much do professional hyperpigmentation treatments cost?",
        a: "Costs vary widely by the treatment, the number of sessions needed, and your location, and most people need a series rather than a single visit. A consultation gives you an accurate estimate for your plan.",
      },
    ],
  },
  {
    slug: "dermal-fillers-101",
    title: "Dermal Fillers 101: Types, Costs, Longevity, and What to Expect",
    description:
      "A plain-English guide to dermal fillers, the types, what each treats, how long results last, typical costs, and how to choose a provider.",
    category: "Treatments",
    author: "Medspa Maps Editorial Team",
    datePublished: "2026-08-21",
    dateModified: "2026-08-21",
    readingMinutes: 8,
    heroImage: "/images/blog/dermal-fillers-101-hero.jpeg",
    heroAlt: "A provider administering a dermal filler injection to a client at a med spa.",
    keyTakeaways: [
      "Dermal fillers are injectable gels, most often hyaluronic acid (HA), that restore volume, smooth lines, and subtly reshape features like the lips and cheeks.",
      "The main families are HA fillers (Juvéderm, Restylane), calcium hydroxylapatite (Radiesse), poly-L-lactic acid (Sculptra), and PMMA (Bellafill).",
      "Results typically last 6–18 months for HA fillers and up to two years or more for collagen-stimulating fillers.",
      "Filler is usually priced per syringe, and most areas take one to two syringes; the total varies by product, provider, and location.",
      "HA fillers are reversible (they can be dissolved with hyaluronidase), while most other types are not.",
      "Fillers are FDA-cleared and generally well tolerated, but should only be injected by a trained, licensed medical provider.",
    ],
    cta: {
      label: "Find dermal filler providers near you",
      href: "/search?q=dermal-fillers",
    },
    faqs: [
      {
        q: "How long do dermal fillers last?",
        a: "It depends on the product and the area treated. Most hyaluronic acid fillers last roughly 6 to 18 months, while collagen-stimulating fillers like Sculptra can last two years or more. Highly mobile areas such as the lips tend to break down filler faster than the cheeks.",
      },
      {
        q: "Do dermal filler injections hurt?",
        a: "Most people feel a brief pinch and some pressure. Many fillers contain lidocaine to reduce discomfort, and providers often apply a numbing cream first, so treatment is usually well tolerated.",
      },
      {
        q: "How much do dermal fillers cost?",
        a: "Filler is commonly priced per syringe, and most treatment areas take one to two syringes. Your total depends on the product used, how many syringes you need, and your provider and location, so a consultation is the best way to get an accurate quote.",
      },
      {
        q: "Are dermal fillers permanent?",
        a: "Most are not. Hyaluronic acid fillers gradually break down over months, and even longer-lasting biostimulators eventually fade. PMMA fillers such as Bellafill are considered semi-permanent.",
      },
      {
        q: "Can dermal filler be dissolved?",
        a: "Hyaluronic acid fillers can be dissolved with an enzyme called hyaluronidase if you are unhappy with the result or in the event of a complication. Most other filler types cannot be easily reversed.",
      },
      {
        q: "How soon will I see results?",
        a: "Hyaluronic acid fillers show results almost immediately, with final results appearing once any swelling settles over one to two weeks. Collagen-stimulating fillers work gradually over several weeks to months.",
      },
      {
        q: "What is the difference between filler and Botox?",
        a: "Fillers add volume to plump lines and restore fullness, while Botox and other neuromodulators relax the muscles that create expression wrinkles. They address different concerns and are often combined.",
      },
      {
        q: "Who should not get dermal fillers?",
        a: "Fillers are generally not recommended during pregnancy or breastfeeding, for people with certain infections or allergies, or for those with a history of specific immune conditions. A consultation with a licensed medical provider determines whether you are a candidate.",
      },
    ],
  },
];
