/**
 * Concern catalog — editorial copy for the 10 Phase-0 priority conditions.
 *
 * The *list* of concerns and the concern↔service mapping live in
 * src/lib/taxonomy/canonical.ts (CANONICAL_CONCERNS). This file holds the
 * rendered editorial content (overview + the detail cards) for each concern,
 * keyed by the same slug. scripts/reconcile-taxonomy.ts seeds `concerns.overview`
 * and `concerns.details` from here.
 *
 * triggers / serviceKeywords / imageKeywords are retained for the legacy
 * bulk importer (scripts/ingest-sites.ts) which derives concerns from scraped
 * page evidence.
 */

export interface ConcernDetails {
  signs?: string;
  causes?: string;
  candidate?: string;
  results?: string;
  treatment_areas?: string;
  injectables?: string;
  benefits?: string;
  prevention?: string;
}

export interface ConcernDef {
  /** canonical concern slug (matches CANONICAL_CONCERNS) */
  slug: string;
  name: string;
  /** keywords that, found in scraped service names/text, signal this concern */
  triggers: string[];
  /** service-name keywords used to link scraped services to this concern */
  serviceKeywords: string[];
  /** service-name substrings that DISQUALIFY a match (kills false positives) */
  excludeKeywords?: string[];
  /** tokens matched against before/after image URL filenames for attribution */
  imageKeywords: string[];
  overview: string;
  details: ConcernDetails;
}

export const CONCERN_CATALOG: ConcernDef[] = [
  {
    slug: "fine-lines-wrinkles",
    name: "Wrinkles & Fine Lines",
    triggers: ["wrinkle", "fine line", "anti-aging", "anti aging", "botox", "tox", "dysport", "filler", "microneedling", "resurfacing"],
    serviceKeywords: ["botox", "tox", "dysport", "filler", "microneedling", "rf skin tightening", "skin tightening", "laser skin resurfacing", "resurfacing"],
    imageKeywords: ["botox", "dysport", "tox", "filler", "microneedl", "resurfacing", "laser"],
    overview:
      "Fine lines and wrinkles are among the most common visible signs of aging. They form from repeated facial movement and the natural loss of collagen and elastin over time. A range of injectable, energy-based, and resurfacing treatments can soften their appearance while preserving natural expression.",
    details: {
      signs: "Forehead lines, crow's feet, smile lines, and fine creases caused by repeated facial movement and natural collagen loss.",
      causes: "Aging, sun exposure, genetics, and reduced collagen production all contribute to the development of fine lines and wrinkles.",
      candidate: "Adults looking to soften visible signs of aging, prevent deeper wrinkles, or maintain a refreshed, natural appearance.",
      results: "Smoother, younger-looking skin with treatments designed to reduce wrinkles while preserving natural facial expressions.",
      treatment_areas: "Forehead, frown lines, crow's feet, lip lines, cheeks, and the neck.",
      injectables: "Botox and dermal fillers soften dynamic wrinkles and restore youthful balance; microneedling, RF tightening, and laser resurfacing rebuild collagen.",
      benefits: "Treatments that support natural collagen production improve firmness, elasticity, and long-term skin health.",
      prevention: "Daily SPF, medical-grade skincare, and maintenance treatments help slow visible signs of aging over time.",
    },
  },
  {
    slug: "acne-scars",
    name: "Acne Scars",
    triggers: ["acne scar", "acne scars", "scarring", "pitted", "microneedling", "chemical peel", "resurfacing"],
    serviceKeywords: ["microneedling", "chemical peel", "laser skin resurfacing", "resurfacing", "rf skin tightening"],
    excludeKeywords: ["filler", "vaginal"],
    imageKeywords: ["acne", "scar", "microneedl", "peel", "resurfacing"],
    overview:
      "Acne scars are the textural marks left behind after breakouts heal. Resurfacing treatments, microneedling, and chemical peels remodel the skin's surface and stimulate collagen to smooth pitted scarring and restore a more even texture.",
    details: {
      signs: "Pitted or depressed scars, raised scars, post-inflammatory marks, and uneven, textured skin from past breakouts.",
      causes: "Deeper inflammation from acne that damages collagen, leading to indentations or raised tissue as the skin heals.",
      candidate: "Teens and adults with residual acne scarring or uneven texture who want smoother, clearer skin.",
      results: "Visibly smoother texture and softened scarring after a series of resurfacing or microneedling treatments.",
      treatment_areas: "Face, back, chest, and other areas affected by past acne.",
      injectables: "Treatment is primarily resurfacing-based; microneedling and chemical peels are common first-line options.",
      benefits: "Refined texture, reduced scar depth, and renewed confidence in clearer skin.",
      prevention: "Treating active acne early and maintaining a medical-grade skincare routine help limit future scarring.",
    },
  },
  {
    slug: "hyperpigmentation",
    name: "Hyperpigmentation",
    triggers: ["hyperpigmentation", "pigment", "uneven tone", "discoloration", "ipl", "photofacial", "chemical peel"],
    serviceKeywords: ["chemical peel", "ipl", "photofacial", "laser skin resurfacing", "resurfacing", "microneedling"],
    excludeKeywords: ["filler", "vaginal", "hair"],
    imageKeywords: ["pigment", "ipl", "photofacial", "peel", "laser", "tone"],
    overview:
      "Hyperpigmentation is the darkening of patches of skin caused by excess melanin. Chemical peels, IPL photofacials, and laser resurfacing break up pigment and renew the surface to restore a brighter, more even complexion.",
    details: {
      signs: "Patches of darker skin, uneven tone, blotchiness, and lingering marks after inflammation or sun exposure.",
      causes: "Excess melanin production triggered by UV exposure, inflammation, hormones, or skin injury.",
      candidate: "Adults with uneven pigmentation or discoloration seeking a clearer, more even-toned complexion.",
      results: "Brighter, more even skin tone after a tailored series of resurfacing and light-based treatments.",
      treatment_areas: "Face, neck, chest, hands, and other sun-exposed areas.",
      injectables: "Pigment concerns are treated with light-based and resurfacing treatments rather than injectables.",
      benefits: "A clearer, more radiant complexion and improved overall skin health.",
      prevention: "Daily SPF and antioxidant skincare prevent recurrence and protect treatment results.",
    },
  },
  {
    slug: "skin-laxity-sagging",
    name: "Loose & Sagging Skin",
    triggers: ["laxity", "sagging", "loose skin", "tighten", "lift", "ultherapy", "rf skin tightening", "thread"],
    serviceKeywords: ["ultherapy", "rf skin tightening", "skin tightening", "pdo thread", "thread", "microneedling"],
    excludeKeywords: ["vaginal"],
    imageKeywords: ["tightening", "ultherapy", "thread", "pdo", "lift", "microneedl"],
    overview:
      "Loss of skin firmness leads to sagging along the jawline, neck, and cheeks. Focused ultrasound, radiofrequency tightening, threads, and collagen-stimulating treatments restore a firmer, lifted appearance without surgery.",
    details: {
      signs: "Loose skin along the jawline and neck, jowling, and reduced firmness on the face and body.",
      causes: "Collagen and elastin decline, aging, weight changes, and gravity.",
      candidate: "Adults with mild to moderate skin laxity who want non-surgical tightening and lift.",
      results: "Gradual firming and lifting as new collagen forms over the weeks and months following treatment.",
      treatment_areas: "Jawline, neck, cheeks, brows, and body areas with loose skin.",
      injectables: "PDO threads provide lift while energy devices such as Ultherapy and RF tighten tissue.",
      benefits: "A firmer, more contoured, naturally lifted appearance without surgery.",
      prevention: "Ongoing collagen-stimulating treatments help maintain firmness over time.",
    },
  },
  {
    slug: "double-chin-submental-fullness",
    name: "Double Chin",
    triggers: ["kybella", "double chin", "submental", "chin fat", "coolsculpting"],
    serviceKeywords: ["kybella", "coolsculpting", "rf skin tightening", "skin tightening"],
    imageKeywords: ["kybella", "submental", "chin", "coolsculpting"],
    overview:
      "Submental fullness — the 'double chin' — can persist despite diet and exercise. Fat-dissolving injections, cryolipolysis, and skin tightening reduce fullness beneath the chin for a more sculpted profile.",
    details: {
      signs: "Fullness or a 'double chin' beneath the jaw, even at a healthy weight.",
      causes: "Genetics, aging, and weight changes that lead to stubborn submental fat and laxity.",
      candidate: "Adults bothered by fullness under the chin who want a non-surgical contouring option.",
      results: "A more defined, sculpted jaw and chin profile after a series of treatments.",
      treatment_areas: "The submental area beneath the chin and along the jawline.",
      injectables: "Kybella (deoxycholic acid) permanently destroys treated fat cells; CoolSculpting freezes it.",
      benefits: "A slimmer, more contoured profile without surgery.",
      prevention: "Results are long-lasting once the desired contour is achieved.",
    },
  },
  {
    slug: "sun-damage",
    name: "Sun Damage",
    triggers: ["sun damage", "sun spot", "photodamage", "ipl", "photofacial", "chemical peel", "resurfacing"],
    serviceKeywords: ["ipl", "photofacial", "chemical peel", "laser skin resurfacing", "resurfacing"],
    excludeKeywords: ["filler", "vaginal", "hair"],
    imageKeywords: ["sun", "ipl", "photofacial", "peel", "laser", "spot"],
    overview:
      "Years of sun exposure leave rough texture, dullness, and visible spots. IPL photofacials, chemical peels, and laser resurfacing fade sun-induced damage and renew the skin for a brighter, healthier complexion.",
    details: {
      signs: "Sun spots, rough or leathery texture, uneven tone, freckling, and overall dullness.",
      causes: "Cumulative UV exposure that damages collagen and stimulates excess melanin.",
      candidate: "Adults with sun spots or weathered, uneven skin seeking a brighter, smoother complexion.",
      results: "Clearer, more even, and visibly refreshed skin after a tailored series of treatments.",
      treatment_areas: "Face, neck, chest, hands, and other sun-exposed areas.",
      injectables: "Sun damage is treated with light-based and resurfacing treatments rather than injectables.",
      benefits: "A brighter, healthier-looking complexion and improved skin quality.",
      prevention: "Daily SPF and antioxidant skincare prevent further damage and protect results.",
    },
  },
  {
    slug: "rosacea",
    name: "Rosacea",
    triggers: ["rosacea", "redness", "flushing", "broken capillaries", "ipl", "photofacial"],
    serviceKeywords: ["ipl", "photofacial", "laser skin resurfacing", "resurfacing"],
    excludeKeywords: ["filler", "vaginal", "hair"],
    imageKeywords: ["rosacea", "redness", "ipl", "photofacial", "vascular"],
    overview:
      "Rosacea causes persistent facial redness, flushing, and visible blood vessels. IPL and laser treatments target the dilated vessels behind the redness to calm the complexion and even out tone.",
    details: {
      signs: "Persistent redness across the cheeks and nose, flushing, visible capillaries, and sometimes bumps.",
      causes: "A combination of genetics, vascular sensitivity, and triggers such as heat, sun, alcohol, and stress.",
      candidate: "Adults with facial redness or visible vessels who want a calmer, more even complexion.",
      results: "Reduced redness and fewer visible vessels after a series of light-based treatments.",
      treatment_areas: "Cheeks, nose, chin, and central face.",
      injectables: "Rosacea is treated with light and laser therapy rather than injectables.",
      benefits: "A calmer, more even-toned complexion and reduced visible flushing.",
      prevention: "Identifying triggers, daily SPF, and gentle skincare help maintain results.",
    },
  },
  {
    slug: "stretch-marks",
    name: "Stretch Marks",
    triggers: ["stretch mark", "stretch marks", "striae", "microneedling", "resurfacing"],
    serviceKeywords: ["microneedling", "laser skin resurfacing", "resurfacing", "rf skin tightening", "skin tightening"],
    excludeKeywords: ["filler", "vaginal"],
    imageKeywords: ["stretch", "striae", "microneedl", "resurfacing"],
    overview:
      "Stretch marks are scars that form when skin stretches rapidly. Microneedling, laser resurfacing, and radiofrequency treatments remodel collagen to soften their texture and blend them with surrounding skin.",
    details: {
      signs: "Streaked lines on the skin that may appear red, purple, or silvery-white over time.",
      causes: "Rapid stretching of the skin from growth, pregnancy, or weight changes that breaks down collagen and elastin.",
      candidate: "Adults bothered by stretch marks who want to improve their texture and appearance.",
      results: "Softer, less noticeable marks and improved texture after a series of treatments.",
      treatment_areas: "Abdomen, hips, thighs, breasts, arms, and other areas with stretch marks.",
      injectables: "Stretch marks are treated with resurfacing and collagen-stimulating treatments rather than injectables.",
      benefits: "Smoother, more even skin texture and reduced visibility of marks.",
      prevention: "Maintaining stable weight and skin hydration helps limit new stretch marks.",
    },
  },
  {
    slug: "dark-spots-melasma",
    name: "Dark Spots & Melasma",
    triggers: ["dark spot", "melasma", "age spot", "brown spot", "pigment", "chemical peel", "ipl"],
    serviceKeywords: ["chemical peel", "ipl", "photofacial", "laser skin resurfacing", "resurfacing"],
    excludeKeywords: ["filler", "vaginal", "hair"],
    imageKeywords: ["melasma", "dark", "spot", "pigment", "peel", "ipl", "laser"],
    overview:
      "Dark spots and melasma are stubborn forms of pigmentation that can be triggered by sun and hormones. Carefully selected chemical peels, IPL, and laser treatments lighten the discoloration and even out skin tone.",
    details: {
      signs: "Brown or gray-brown patches, age spots, and symmetric facial discoloration that worsens with sun.",
      causes: "Excess melanin driven by sun exposure, hormonal changes (including pregnancy and birth control), and inflammation.",
      candidate: "Adults with melasma, age spots, or persistent discoloration seeking a more even complexion.",
      results: "Lightened pigmentation and a more even tone after a carefully tailored treatment series.",
      treatment_areas: "Cheeks, forehead, upper lip, and other areas of facial pigmentation.",
      injectables: "Pigment is treated with resurfacing, peels, and light-based treatments rather than injectables.",
      benefits: "A brighter, more even complexion with reduced discoloration.",
      prevention: "Strict daily SPF and pigment-focused skincare are essential to prevent recurrence.",
    },
  },
  {
    slug: "stubborn-body-fat",
    name: "Stubborn Body Fat",
    triggers: ["stubborn fat", "body fat", "fat reduction", "coolsculpting", "body contouring", "kybella"],
    serviceKeywords: ["coolsculpting", "body contouring", "body sculpting", "kybella"],
    imageKeywords: ["coolsculpting", "contouring", "sculpting", "fat", "kybella"],
    overview:
      "Stubborn pockets of fat can resist even consistent diet and exercise. Non-surgical body contouring and fat-reduction treatments such as CoolSculpting and EmSculpt reduce fat and refine the body's shape without downtime.",
    details: {
      signs: "Localized fat on the abdomen, flanks, thighs, arms, or under the chin that won't budge with diet and exercise.",
      causes: "Genetics and hormones determine where the body stores stubborn fat that resists lifestyle changes.",
      candidate: "Adults near their goal weight who want to reduce specific pockets of stubborn fat.",
      results: "A more contoured, refined shape after a series of treatments, with gradual fat reduction over weeks.",
      treatment_areas: "Abdomen, flanks, thighs, arms, back, and under the chin.",
      injectables: "Kybella dissolves small fat pockets; CoolSculpting and body contouring address larger areas non-surgically.",
      benefits: "Reduced stubborn fat and improved contour without surgery or downtime.",
      prevention: "Results are long-lasting when paired with a stable, healthy lifestyle.",
    },
  },
];
