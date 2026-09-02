import type { LandingContent } from "./types";

/**
 * Treatment landing-page content registry (→ /treatment/[slug]).
 * Copy transcribed from `pages-docs/SERVICE-*.docx`. Images are local
 * Adobe Stock photos under /public/images/landing, assigned to the hero
 * slot (most landscape) and alternating down the page thereafter.
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
    src: "/images/landing/AdobeStock_2161812143.jpeg",
    alt: "A provider injecting Botox into a patient's forehead with gloved hands in a treatment room",
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
      image: {
        src: "/images/landing/AdobeStock_222371752.jpeg",
        alt: "A provider injecting Botox near a patient's brow",
      },
    },
    {
      id: "how-does-botox-work",
      heading: "How does Botox",
      headingAccent: "work?",
      body: [
        "Botox works by temporarily blocking the nerve signals that tell certain muscles to contract. When those muscles relax, the overlying skin smooths out, and the lines caused by repeated movement soften.",
        "The effect is localized to the small areas where it is injected, so a skilled injector can relax the muscles that cause wrinkles while preserving natural expression.",
      ],
      image: {
        src: "/images/landing/AdobeStock_499147015.jpeg",
        alt: "A provider injecting a neuromodulator into a patient's forehead",
      },
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
      image: {
        src: "/images/landing/AdobeStock_436199878.jpeg",
        alt: "A provider assessing a patient's face before an injectable treatment",
      },
    },
    {
      id: "botox-vs-alternatives",
      heading: "Botox vs. Dysport, Xeomin, and",
      headingAccent: "Jeuveau",
      body: [
        "Botox, Dysport, Xeomin, and Jeuveau are all neuromodulators made from botulinum toxin, and they treat the same kinds of expression lines. They differ slightly in formulation, how quickly they take effect, and how they spread, and a provider can help you choose.",
        "In practice, the choice often comes down to your provider's recommendation for your anatomy and goals rather than a meaningful difference in results.",
      ],
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

const dermalFillers: LandingContent = {
  kind: "treatment",
  slug: "dermal-fillers",
  title: "Dermal Fillers: Types, Uses, and How to Find a Provider",
  shortName: "Dermal Fillers",
  metaTitle: "Dermal Fillers: Types, Uses & How to Find a Provider | Med Spa Maps",
  metaDescription:
    "What dermal fillers are, the main types, what they treat, longevity, safety, and how to find and compare qualified filler providers near you.",
  updated: "August 2026",
  datePublishedISO: "2026-08-21",
  dateModifiedISO: "2026-08-21",
  hero: {
    src: "/images/landing/AdobeStock_2172454579.jpeg",
    alt: "A provider injecting dermal filler near a patient's nose and upper lip in a clinical treatment room",
  },
  atGlance: [
    "Dermal fillers are injectable gels, most often hyaluronic acid, that restore volume, smooth lines, and refine facial contours.",
    "Common areas include the lips, cheeks, under-eyes, and the folds around the mouth.",
    "Most hyaluronic acid fillers last about 6 to 18 months; collagen-stimulating fillers can last longer.",
    "Hyaluronic acid fillers are reversible and can be dissolved if needed; most other types are not.",
    "Fillers should only be injected by a licensed medical provider trained in injectables.",
    "Use Med Spa Maps to find and compare qualified filler providers near you.",
  ],
  sections: [
    {
      id: "what-are-dermal-fillers",
      heading: "What are",
      headingAccent: "dermal fillers?",
      body: [
        "Dermal fillers are injectable gels placed beneath the skin to restore lost volume, soften lines and folds, and enhance features like the lips and cheeks. The most common type is made from hyaluronic acid, a substance your body produces naturally.",
        "Unlike Botox, which relaxes muscles, fillers physically replace volume that is lost with age or add definition where you want it. Different formulations are chosen for different jobs, from soft filler for delicate under-eye skin to firmer gels that rebuild structure.",
      ],
      pullQuote:
        "Dermal fillers are injectable gels, most often made from hyaluronic acid, that restore lost volume, soften folds, and subtly enhance facial features.",
    },
    {
      id: "what-can-dermal-fillers-treat",
      heading: "What can dermal fillers",
      headingAccent: "treat?",
      body: [
        "Fillers are used across the face and hands to restore volume, smooth folds, and refine shape. The most common areas are the lips, cheeks, under-eyes, and the lines around the mouth.",
      ],
      bullets: [
        "Lips: volume, definition, and hydration, or balancing shape.",
        "Cheeks and midface: restoring lift and fullness that flattens with age.",
        "Under-eyes: softening hollows and shadows; a delicate area for an experienced injector.",
        "Nasolabial folds and marionette lines: the creases from the nose to the mouth and chin.",
        "Jawline and chin: sharpening definition and improving profile balance.",
      ],
      image: {
        src: "/images/landing/AdobeStock_2042592560.jpeg",
        alt: "Close-up of a provider injecting dermal filler along a patient's jawline",
      },
    },
    {
      id: "types-of-dermal-fillers",
      heading: "What types of dermal fillers are",
      headingAccent: "there?",
      body: [
        "The main categories are hyaluronic acid fillers (such as Juvéderm and Restylane), calcium hydroxylapatite (Radiesse), poly-L-lactic acid (Sculptra), and PMMA (Bellafill). They differ in what they are best at and how long they last.",
        "For a deeper walk-through of each type, our Dermal Fillers 101 guide covers longevity, aftercare, and safety in detail.",
      ],
      table: {
        headers: ["Type", "Examples", "Best known for", "Typical longevity"],
        rows: [
          ["Hyaluronic acid", "Juvéderm, Restylane", "Volume, lines, hydration; reversible", "6–18 months"],
          ["Calcium hydroxylapatite", "Radiesse", "Volume and collagen stimulation", "12–18 months"],
          ["Poly-L-lactic acid", "Sculptra", "Gradual collagen rebuilding", "Up to 2+ years"],
          ["PMMA", "Bellafill", "Semi-permanent structural support", "5+ years"],
        ],
      },
    },
    {
      id: "how-long-do-fillers-last-and-cost",
      heading: "How long do fillers last, and how much do they",
      headingAccent: "cost?",
      body: [
        "Most hyaluronic acid fillers last six to eighteen months, while biostimulators can last two years or more. Filler is typically priced per syringe, and the total depends on the product, how many syringes you need, and your provider, so a consultation gives the most accurate quote.",
        "Because filler is a medical treatment where skill matters, the lowest-priced option is not always the safest or the most natural-looking.",
      ],
      image: {
        src: "/images/landing/AdobeStock_256216372.jpeg",
        alt: "A patient receiving a dermal filler injection in the lower face",
      },
    },
    {
      id: "are-dermal-fillers-safe",
      heading: "Are dermal fillers",
      headingAccent: "safe?",
      body: [
        "Dermal fillers are FDA-cleared and generally well tolerated when injected by a trained, licensed medical provider. Most side effects, such as swelling and bruising, are mild and temporary.",
        "Rare but serious complications are possible, which is exactly why provider expertise and knowledge of facial anatomy matter so much. Hyaluronic acid fillers have the added safety benefit of being reversible with an enzyme if needed.",
      ],
    },
  ],
  provider: {
    intro: [
      "Look for a licensed medical professional with specific injectable training, a portfolio of natural-looking results, and a consultation-first approach. Who holds the needle matters more than almost anything else with fillers.",
    ],
    tips: [
      "Credentials: a physician, PA, NP, or supervised RN trained in injectables.",
      "A natural aesthetic: before-and-after photos that look balanced, not overfilled.",
      "Product transparency: they explain which filler they recommend and why.",
      "Complication readiness: they keep dissolving agent on hand and know how to manage problems.",
      "Reviews: consistent, credible feedback from other patients.",
    ],
  },
  faqs: [
    {
      q: "How long do dermal fillers last?",
      a: "Most hyaluronic acid fillers last about six to eighteen months, while collagen-stimulating fillers can last two years or more. Longevity depends on the product and the area treated; mobile areas like the lips tend to break down filler faster.",
    },
    {
      q: "How much do dermal fillers cost?",
      a: "Filler is commonly priced per syringe, and most areas take one to two syringes. The total depends on the product, how many syringes you need, and your provider and location, so a consultation is the best way to get an accurate quote.",
    },
    {
      q: "Are dermal fillers permanent?",
      a: "Most are not. Hyaluronic acid fillers gradually break down over months, and even longer-lasting biostimulators eventually fade. Hyaluronic acid fillers can also be dissolved if needed.",
    },
    {
      q: "Do fillers look natural?",
      a: "In experienced hands, fillers can look very natural. Results depend heavily on the injector's skill and an approach that enhances your features rather than overfilling, which is why choosing the right provider matters.",
    },
    {
      q: "Does getting fillers hurt?",
      a: "Most people tolerate filler well. Many products contain lidocaine, and providers often apply numbing cream first, so discomfort is usually minor.",
    },
    {
      q: "What is the difference between filler and Botox?",
      a: "Dermal fillers add volume to plump lines and restore fullness, while Botox relaxes the muscles that create expression wrinkles. They address different concerns and are often used together.",
    },
  ],
  searchCta: { label: "Find filler providers near you", href: "/search?q=dermal-fillers" },
  schemaAbout: { type: "MedicalProcedure", name: "Dermal filler injection" },
};

const facials: LandingContent = {
  kind: "treatment",
  slug: "facials",
  title: "Facials: Types, Benefits, and How to Find a Provider",
  shortName: "Facials",
  metaTitle: "Facials: Types, Benefits & How to Find a Provider | Med Spa Maps",
  metaDescription:
    "What a facial is, the main types, the benefits, spa vs. medical facials, and how to find and compare skincare providers near you.",
  updated: "August 2026",
  datePublishedISO: "2026-08-21",
  dateModifiedISO: "2026-08-21",
  hero: {
    src: "/images/landing/AdobeStock_492699325.jpeg",
    alt: "An esthetician applying a cleansing mask to a client's face during a spa facial",
  },
  atGlance: [
    "A facial is a professional skincare treatment that cleanses, exfoliates, and hydrates the skin, often with a mask and massage.",
    "Medical or medspa facials add clinical-grade products and devices to target acne, aging, pigmentation, and more.",
    "Popular types include HydraFacial, chemical peels, microdermabrasion, dermaplaning, and microneedling facials.",
    "Most basic facials have no downtime; more intensive treatments may cause brief redness or flaking.",
    "Getting facials regularly, often about monthly, supports healthier skin over time.",
    "Use Med Spa Maps to find and compare facial and skincare providers near you.",
  ],
  sections: [
    {
      id: "what-is-a-facial",
      heading: "What is a",
      headingAccent: "facial?",
      body: [
        "A facial is a professional skincare treatment that typically cleanses, exfoliates, extracts, and hydrates the skin, often finishing with a mask and facial massage. It is designed to improve your skin's health and appearance and can be tailored to your skin type and concerns.",
        "At a medspa, facials often go beyond a basic spa treatment by using clinical-grade products and devices, sometimes under medical supervision, to more directly target concerns like acne, aging, and uneven tone.",
      ],
      pullQuote:
        "A facial is a professional treatment that cleanses, exfoliates, and hydrates the skin; medical-grade facials add clinical products and devices to target specific concerns.",
    },
    {
      id: "types-of-facials",
      heading: "What are the main types of",
      headingAccent: "facials?",
      body: [
        "Facials range from relaxing hydrating treatments to clinical procedures. Common medspa options include the HydraFacial, chemical peels, microdermabrasion, dermaplaning, and microneedling facials.",
      ],
      bullets: [
        "Classic / hydrating facial: cleansing, exfoliation, extractions, and hydration for general skin health.",
        "HydraFacial: a device-based treatment that cleanses, exfoliates, and infuses serums.",
        "Chemical peel: acids that exfoliate to improve tone, texture, and pigmentation.",
        "Microdermabrasion: physical exfoliation to smooth and brighten the skin.",
        "Dermaplaning: gentle scraping that removes dead skin and fine facial hair.",
        "Microneedling facial: micro-injuries that stimulate collagen for texture and tone.",
      ],
      image: {
        src: "/images/landing/AdobeStock_1022983802.jpeg",
        alt: "An esthetician applying a chemical peel during a facial",
      },
    },
    {
      id: "benefits-of-facials",
      heading: "What are the benefits of getting a",
      headingAccent: "facial?",
      body: [
        "Facials can deep-clean and hydrate the skin, improve clarity and glow, support a healthy skin barrier, and address specific concerns like congestion or dullness. Benefits build with consistent, professional treatment.",
        "A professional can also assess your skin and recommend a routine, so a facial doubles as a check-in on your overall skin health. Results are cumulative and depend on your skin and your at-home care.",
      ],
    },
    {
      id: "spa-vs-medical-facial",
      heading: "Spa facial vs. medical facial: what's the",
      headingAccent: "difference?",
      body: [
        "A spa facial focuses on relaxation and general maintenance, while a medical or medspa facial uses clinical-grade products and devices, often with medical oversight, to more aggressively target concerns like acne, aging, and pigmentation.",
        "If your goal is relaxation and glow, a spa-style facial may be perfect. If you are treating a specific concern, a medspa facial with stronger tools may be a better fit. Many providers offer both.",
      ],
    },
  ],
  provider: {
    intro: [
      "Look for a licensed esthetician or a medspa with qualified skincare staff, treatments matched to your skin type, and clear communication about what each facial does. For medical-grade treatments, medical oversight is a plus.",
    ],
    tips: [
      "Licensed estheticians: trained, credentialed skincare professionals.",
      "A skin assessment: they evaluate your skin and recommend the right facial.",
      "Appropriate products: ingredients and strength matched to your skin.",
      "Medical oversight: important for peels and other clinical treatments.",
      "Reviews: consistent, credible feedback from clients.",
    ],
  },
  faqs: [
    {
      q: "What is a facial?",
      a: "A facial is a professional skincare treatment that typically cleanses, exfoliates, extracts, and hydrates the skin, often with a mask and massage. Medical-grade facials may add treatments like chemical peels, microdermabrasion, or dermaplaning for stronger results.",
    },
    {
      q: "How often should you get a facial?",
      a: "A common recommendation is about once a month, which aligns with the skin's natural renewal cycle, though the ideal frequency depends on your skin and goals. A provider can suggest a schedule for you.",
    },
    {
      q: "What is the difference between a spa facial and a medical facial?",
      a: "Spa facials focus on relaxation and general skin maintenance, while medical or medspa facials use clinical-grade products and devices, and are often overseen by medical staff, to target concerns like acne, aging, or pigmentation more aggressively.",
    },
    {
      q: "Do facials really work?",
      a: "Facials can improve hydration, clarity, and glow, and consistent professional treatment supports healthy skin over time. Results are cumulative and vary by skin type, the type of facial, and your at-home routine.",
    },
    {
      q: "How much does a facial cost?",
      a: "Costs vary widely by the type of facial, the provider, and your location, with medical-grade facials generally more involved than basic ones. A provider can give you an accurate estimate.",
    },
    {
      q: "Is there downtime after a facial?",
      a: "Most basic facials have no downtime. More intensive medical facials, such as those with peels or microdermabrasion, may cause temporary redness or flaking for a day or two.",
    },
  ],
  searchCta: { label: "Find facial providers near you", href: "/search?q=facials" },
  searchAliases: { queries: ["hydrafacial"] },
  schemaAbout: { type: "MedicalProcedure", name: "Facial (professional skincare treatment)" },
};

const laserTreatments: LandingContent = {
  kind: "treatment",
  slug: "laser-treatments",
  title: "Laser Skin Treatments: Types, Uses, and How to Find a Provider",
  shortName: "Laser Treatments",
  metaTitle: "Laser Skin Treatments: Types, Uses & How to Find a Provider | Med Spa Maps",
  metaDescription:
    "What laser skin treatments are, the main device types, which laser fits which concern, safety for darker skin, and how to find providers near you.",
  updated: "August 2026",
  datePublishedISO: "2026-08-21",
  dateModifiedISO: "2026-08-21",
  hero: {
    src: "/images/landing/AdobeStock_362944773.jpeg",
    alt: "A provider using a handheld laser device on a client's cheek during a treatment",
  },
  atGlance: [
    "Laser skin treatment is an umbrella term for several technologies that improve tone, texture, pigmentation, redness, and aging.",
    "IPL and BBL use broadband light (not a true laser) and are best for sunspots, redness, and tone.",
    "Resurfacing lasers (ablative and fractional) remodel the skin's surface for wrinkles, texture, and scars.",
    "Non-ablative options like Laser Genesis are gentle with little to no downtime.",
    "Device choice and settings matter greatly for darker skin tones, so provider expertise is essential.",
    "Use Med Spa Maps to find and compare laser providers near you.",
  ],
  sections: [
    {
      id: "what-are-laser-treatments",
      heading: "What are laser skin",
      headingAccent: "treatments?",
      body: [
        "Laser skin treatment is an umbrella term for a range of light- and laser-based procedures that improve skin tone, texture, pigmentation, redness, and signs of aging. They fall into two big splits: true lasers versus intense pulsed light (IPL and BBL), and ablative versus non-ablative.",
        "Understanding those splits is the key to the confusing acronym soup. Ablative devices remove the outer layers of skin for more dramatic results and more downtime, while non-ablative devices heat the deeper skin without wounding the surface, trading intensity for a faster recovery.",
      ],
      pullQuote:
        "IPL and BBL aren't true lasers; they're intense pulsed light. That distinction matters, because light-based treatments and lasers target somewhat different concerns.",
    },
    {
      id: "types-of-laser-treatments",
      heading: "What are the main types of laser and light",
      headingAccent: "treatments?",
      body: [
        "The most common options are IPL and BBL for tone and redness, fractional and ablative resurfacing for texture and wrinkles, and gentle non-ablative lasers like Laser Genesis for maintenance and glow.",
      ],
      table: {
        headers: ["Treatment", "Type", "Best for", "Downtime"],
        rows: [
          ["IPL / BBL", "Intense pulsed light", "Sunspots, redness, tone", "Minimal"],
          ["Fraxel", "Fractional laser", "Texture, fine lines, scars", "2–7 days"],
          ["CO2 / erbium", "Ablative laser", "Deep wrinkles, scars, sun damage", "1–2+ weeks"],
          ["Laser Genesis", "Non-ablative laser", "Redness, pores, fine lines, glow", "None"],
          ["Nd:YAG / Pico", "Laser", "Pigment, redness, tattoo removal", "Minimal"],
        ],
      },
    },
    {
      id: "which-laser-is-best",
      heading: "Which laser is best for my",
      headingAccent: "concern?",
      body: [
        "The right device depends on what you are treating: IPL or BBL for sunspots and redness, fractional or ablative resurfacing for wrinkles and scars, and gentle non-ablative lasers for fine lines and overall glow.",
      ],
      bullets: [
        "Sunspots and pigmentation: IPL or BBL, or pigment-specific lasers.",
        "Redness and rosacea: IPL/BBL and non-ablative lasers.",
        "Wrinkles and texture: fractional or ablative resurfacing.",
        "Acne scars: fractional and ablative resurfacing.",
      ],
      image: {
        src: "/images/landing/AdobeStock_1869574957.jpeg",
        alt: "A light-based device treating pigmentation on a woman's cheek",
      },
    },
    {
      id: "are-laser-treatments-safe",
      heading: "Are laser treatments safe, especially for",
      headingAccent: "darker skin?",
      body: [
        "Laser treatments are generally safe with the right device and settings, but safety for darker skin tones depends heavily on the technology used. Some lasers and settings are safer for deeper skin tones, while aggressive IPL and ablative treatments carry more risk of burns or pigment change.",
        "This is why provider expertise is so important. An experienced provider who treats your skin type and chooses appropriate devices and settings is the single best safeguard.",
      ],
      image: {
        src: "/images/landing/AdobeStock_2100631947.jpeg",
        alt: "Fractional laser skin resurfacing performed with protective eye shields",
      },
    },
  ],
  provider: {
    intro: [
      "Because clinics carry different devices and outcomes depend on skill, choose a provider based on their equipment, experience, and expertise with your skin type. Ask what device they use and why.",
    ],
    tips: [
      "The right devices: clinics vary; make sure they have the technology for your concern.",
      "Experience with your skin type: especially important for deeper skin tones.",
      "Medical oversight: lasers are powerful; qualified, supervised operators matter.",
      "A real consultation: they assess your skin and set realistic expectations.",
      "Reviews: consistent, credible results from other patients.",
    ],
  },
  faqs: [
    {
      q: "What do laser skin treatments do?",
      a: "Laser and light-based treatments use focused energy to improve skin tone, texture, pigmentation, redness, and signs of aging. Different devices target different concerns, from sun spots and redness to wrinkles and scars.",
    },
    {
      q: "Is IPL a laser?",
      a: "No. IPL (intense pulsed light) and BBL use broadband light rather than a single-wavelength laser beam. They are popular for sun spots, redness, and overall tone, and work differently from true lasers.",
    },
    {
      q: "How many laser sessions will I need?",
      a: "Gentler treatments like IPL and Laser Genesis are usually done in a series of several sessions, while a single ablative resurfacing treatment can deliver dramatic results with more downtime. Your provider will recommend a plan.",
    },
    {
      q: "How much do laser treatments cost?",
      a: "Costs vary widely by the device, the intensity, and your provider and location. Lighter treatments are generally more affordable than full ablative resurfacing. A consultation gives you an accurate quote.",
    },
    {
      q: "Are laser treatments safe for dark skin?",
      a: "Some are and some are not. Wavelength and settings are critical; certain lasers like Nd:YAG and conservative settings can be safer for deeper skin tones, while aggressive IPL and ablative treatments carry more risk. Provider expertise is essential.",
    },
    {
      q: "How long is the downtime after laser?",
      a: "Downtime scales with intensity, from essentially none for IPL and Laser Genesis to a week or more for fully ablative CO2 resurfacing.",
    },
  ],
  searchCta: { label: "Find laser providers near you", href: "/search?q=laser-skin-resurfacing" },
  searchAliases: { queries: ["laser-skin-treatments", "laser-treatments"] },
  schemaAbout: { type: "MedicalProcedure", name: "Laser skin treatment" },
};

const microneedling: LandingContent = {
  kind: "treatment",
  slug: "microneedling",
  title: "Microneedling: Benefits, What to Expect, and How to Find a Provider",
  shortName: "Microneedling",
  metaTitle: "Microneedling: Benefits, What to Expect & How to Find a Provider | Med Spa Maps",
  metaDescription:
    "What microneedling is, what it treats, how it compares to RF microneedling, what to expect, and how to find and compare providers near you.",
  updated: "August 2026",
  datePublishedISO: "2026-08-21",
  dateModifiedISO: "2026-08-21",
  hero: {
    src: "/images/landing/AdobeStock_2120028417.jpeg",
    alt: "A provider using a microneedling pen on a client's forehead in a treatment room",
  },
  atGlance: [
    "Microneedling uses fine needles to create controlled micro-injuries that trigger collagen production and skin renewal.",
    "It can improve texture, fine lines, acne scars, large pores, and overall tone.",
    "Most people need a series of about 3 to 6 sessions for the best results, which build gradually.",
    "Downtime is minimal, usually a day or two of redness like a mild sunburn.",
    "RF microneedling adds radiofrequency heat for extra skin tightening.",
    "Use Med Spa Maps to find and compare microneedling providers near you.",
  ],
  sections: [
    {
      id: "what-is-microneedling",
      heading: "What is",
      headingAccent: "microneedling?",
      body: [
        "Microneedling is a minimally invasive treatment that uses a device with fine needles to create tiny, controlled micro-injuries in the skin. This prompts the body's natural healing response, boosting collagen and elastin to renew the skin over time.",
        "It is sometimes called collagen induction therapy and is used on the face and body to improve texture and tone. Because results depend on your skin building new collagen, they develop gradually across a series of sessions.",
      ],
      pullQuote:
        "Microneedling creates controlled micro-injuries that trigger the skin's natural collagen production, gradually improving texture, scars, and tone over a series of treatments.",
    },
    {
      id: "what-does-microneedling-treat",
      heading: "What does microneedling",
      headingAccent: "treat?",
      body: [
        "Microneedling is most often used for uneven texture, acne scars, fine lines, enlarged pores, and dull or uneven tone. It is also used to help skincare ingredients absorb more effectively.",
      ],
      bullets: [
        "Acne scars and texture: one of its most popular and well-supported uses.",
        "Fine lines and early aging: by stimulating fresh collagen.",
        "Large pores and dullness: improving smoothness and glow.",
        "Uneven tone: often paired with brightening serums or PRP.",
      ],
      image: {
        src: "/images/landing/AdobeStock_1819566272.jpeg",
        alt: "A microneedling pen being used along a patient's jawline",
      },
    },
    {
      id: "microneedling-vs-rf-microneedling",
      heading: "Microneedling vs. RF microneedling: what's the",
      headingAccent: "difference?",
      body: [
        "Standard microneedling relies on micro-injuries alone, while RF (radiofrequency) microneedling delivers heat energy through the needles to reach deeper layers. That added heat can improve skin tightening and is often chosen for laxity as well as texture.",
        "RF microneedling tends to cost more than traditional microneedling and may involve slightly more downtime, but it can do more for sagging skin. A provider can help you decide which fits your goals.",
      ],
      image: {
        src: "/images/landing/AdobeStock_1949785677.jpeg",
        alt: "A provider performing microneedling on a patient's forehead",
      },
    },
    {
      id: "what-to-expect",
      heading: "What to expect: sessions, downtime, and",
      headingAccent: "results",
      body: [
        "A microneedling session usually takes about 30 to 60 minutes after numbing, with a day or two of redness afterward. Most people need a series of three to six sessions spaced a few weeks apart, and results build over the following months as collagen develops.",
      ],
      bullets: [
        "Expect redness and mild sensitivity for a day or two, similar to a sunburn.",
        "Avoid sun exposure and wear SPF while your skin heals.",
        "Follow your provider's aftercare, including gentle skincare for a few days.",
        "Plan a series rather than expecting results from a single session.",
      ],
      image: {
        src: "/images/landing/AdobeStock_1693808872.jpeg",
        alt: "A provider consulting with a client about a treatment plan at a medspa",
      },
    },
    {
      id: "is-microneedling-safe",
      heading: "Is microneedling",
      headingAccent: "safe?",
      body: [
        "Professional microneedling is generally safe for most skin types when performed by a trained provider, and it is often considered a good option across a range of skin tones. Side effects are usually limited to temporary redness and sensitivity.",
        "Safety and results depend heavily on technique, device quality, and hygiene, which is why professional treatment is very different from at-home rolling. A provider will confirm whether you are a good candidate.",
      ],
    },
  ],
  provider: {
    intro: [
      "Look for a licensed skincare or medical professional who uses a professional-grade device, follows strict hygiene, and can explain a realistic treatment plan for your skin.",
    ],
    tips: [
      "Qualified provider: a licensed esthetician, nurse, or medical professional trained on the device.",
      "Professional equipment: a medical-grade device, not a consumer roller.",
      "A clear plan: they recommend a session count and spacing based on your goals.",
      "Skin-type experience: especially important for deeper skin tones.",
      "Reviews: credible feedback and consistent results.",
    ],
  },
  faqs: [
    {
      q: "What does microneedling do?",
      a: "Microneedling creates tiny controlled micro-injuries in the skin that trigger the body's natural healing and collagen production. Over a series of treatments, this can improve skin texture, fine lines, acne scars, large pores, and overall tone.",
    },
    {
      q: "Does microneedling really work?",
      a: "For many people, yes. Microneedling is a well-established treatment for texture, acne scars, and early signs of aging, though results build gradually over a series of sessions and vary from person to person.",
    },
    {
      q: "How many microneedling sessions will I need?",
      a: "Most people need a series of about three to six sessions spaced a few weeks apart, depending on their skin and goals. Your provider will recommend a plan during a consultation.",
    },
    {
      q: "Is microneedling painful?",
      a: "A numbing cream is usually applied first, so most people feel only mild pressure or a scratchy sensation. Some redness afterward, similar to a mild sunburn, is normal for a day or two.",
    },
    {
      q: "What is the difference between microneedling and RF microneedling?",
      a: "RF (radiofrequency) microneedling adds heat energy through the needles to reach deeper layers of skin, which can enhance skin tightening. Standard microneedling relies on the micro-injuries alone. A provider can help you decide which suits your goals.",
    },
    {
      q: "How much does microneedling cost?",
      a: "Costs vary by the type of microneedling, the provider, and your location, and most people need a series rather than a single session. A consultation gives you an accurate estimate.",
    },
  ],
  searchCta: { label: "Find microneedling providers near you", href: "/search?q=microneedling" },
  schemaAbout: { type: "MedicalProcedure", name: "Microneedling (collagen induction therapy)" },
};

export const TREATMENT_PAGES: Record<string, LandingContent> = {
  botox,
  "dermal-fillers": dermalFillers,
  facials,
  "laser-treatments": laserTreatments,
  microneedling,
};

export function getTreatmentPage(slug: string): LandingContent | null {
  return TREATMENT_PAGES[slug] ?? null;
}

export function allTreatmentSlugs(): string[] {
  return Object.keys(TREATMENT_PAGES);
}
