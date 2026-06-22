/**
 * Concern catalog + derivation.
 *
 * Concerns are DERIVED from scraped content: a concern is only produced when
 * evidence for it appears in the scraped service names / descriptions / page
 * text of the source sites. The editorial copy (the cards rendered on the
 * concern page) is templated per concern; the *list* of concerns that exist,
 * and the services linked to each, come entirely from what was scraped.
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
    name: "Fine Lines & Wrinkles",
    triggers: ["wrinkle", "fine line", "anti-aging", "anti aging", "botox", "tox", "dysport", "xeomin", "filler", "facial balancing", "thread", "pdo"],
    serviceKeywords: ["tox", "botox", "dysport", "xeomin", "filler", "biostimulator", "facial balancing", "thread", "pdo", "endolift", "rf microneedling", "microneedling"],
    imageKeywords: ["botox", "dysport", "xeomin", "tox", "filler", "thread", "pdo", "microneedl", "endolift", "morpheus"],
    overview:
      "Fine lines and wrinkles are among the most common visible signs of aging. They form from repeated facial movement and the natural loss of collagen and elastin over time. A range of injectable and energy-based treatments can soften their appearance while preserving natural expression.",
    details: {
      signs: "Commonly appear as forehead lines, crow's feet, smile lines, and fine creases caused by repeated facial movements and natural collagen loss.",
      causes: "Aging, sun exposure, genetics, lifestyle habits, and reduced collagen production all contribute to the development of fine lines and wrinkles.",
      candidate: "Adults looking to soften visible signs of aging, prevent deeper wrinkle formation, or maintain a refreshed, natural appearance.",
      results: "Many patients notice smoother, younger-looking skin with treatments designed to reduce wrinkles while preserving natural facial expressions.",
      treatment_areas: "Forehead lines, frown lines, crow's feet, lip lines, neck lines, and areas with visible skin texture concerns.",
      injectables: "Botox®, Dysport®, Xeomin®, and dermal fillers help soften dynamic wrinkles and restore youthful facial balance.",
      benefits: "Treatments that support natural collagen production can help improve firmness, elasticity, and long-term skin health.",
      prevention: "Personalized treatment plans help slow visible signs of aging and maintain healthy, radiant skin over time.",
    },
  },
  {
    name: "Volume Loss & Facial Hollows",
    triggers: ["filler", "volume", "cheek", "lip", "facial balancing", "biostimulator", "sculptra", "restylane", "juvederm", "bbl"],
    serviceKeywords: ["filler", "biostimulator", "facial balancing", "liquid bbl", "restylane", "juvederm", "sculptra", "skinvive", "radiesse", "renuva"],
    imageKeywords: ["filler", "sculptra", "radiesse", "renuva", "bbl", "lip", "cheek", "skinvive"],
    overview:
      "As we age, the face loses fat, bone, and collagen, leading to flattened cheeks, hollow under-eyes, and thinning lips. Dermal fillers and biostimulators restore lost volume and rebalance facial proportions.",
    details: {
      signs: "Flattened cheeks, hollow temples, under-eye shadows, deepening folds, and loss of lip fullness.",
      causes: "Age-related loss of facial fat, bone resorption, and declining collagen and hyaluronic acid.",
      candidate: "Adults seeking to restore youthful contour, enhance lips or cheeks, or rebalance facial proportions.",
      results: "Natural-looking restoration of volume and contour, with immediate and progressive improvement depending on the product used.",
      treatment_areas: "Cheeks, lips, under-eyes, temples, chin, jawline, and nasolabial folds.",
      injectables: "Dermal fillers and collagen-stimulating biostimulators rebuild structure and volume.",
      benefits: "Improved facial harmony, lift, and a refreshed appearance without surgery.",
      prevention: "Maintenance treatments preserve collagen and contour over time.",
    },
  },
  {
    name: "Acne & Acne Scars",
    triggers: ["acne", "scar", "chemical peel", "microneedling", "skinpen", "laser peel", "rf microneedling", "facial"],
    serviceKeywords: ["chemical peel", "laser peel", "microneedling", "skinpen", "rf microneedling", "facial treatment", "prp", "prf"],
    excludeKeywords: ["balancing", "filler", "vaginal"],
    imageKeywords: ["acne", "prp", "prf", "microneedl", "peel", "facial"],
    overview:
      "Acne and the scars it leaves behind affect skin texture and tone. Resurfacing peels, microneedling, and laser treatments help clear active breakouts and smooth scarring for clearer, healthier skin.",
    details: {
      signs: "Active breakouts, blackheads, enlarged pores, post-inflammatory marks, and pitted or textured acne scars.",
      causes: "Excess oil, clogged pores, bacteria, hormones, and inflammation; scarring results from deeper skin damage.",
      candidate: "Teens and adults with active acne, recurring breakouts, or residual acne scarring and uneven texture.",
      results: "Clearer skin, reduced breakouts, and smoother texture with a series of resurfacing or microneedling treatments.",
      treatment_areas: "Face, back, chest, and other acne-prone areas.",
      injectables: "Treatment is primarily resurfacing-based; chemical peels and microneedling are common first-line options.",
      benefits: "Improved tone, refined pores, and renewed confidence in clearer skin.",
      prevention: "Medical-grade skincare and routine maintenance help keep breakouts under control.",
    },
  },
  {
    name: "Sun Damage & Pigmentation",
    triggers: ["pigment", "sun damage", "dark spot", "melasma", "hyperpigment", "chemical peel", "laser peel", "ipl", "photofacial", "bbl"],
    serviceKeywords: ["chemical peel", "laser peel", "laser skin", "ipl", "photofacial", "peel", "skincare", "sylfirm"],
    excludeKeywords: ["balancing", "filler", "vaginal", "hair"],
    imageKeywords: ["laser", "peel", "ipl", "photofacial", "pigment", "sylfirm", "skincare"],
    overview:
      "Years of sun exposure can leave dark spots, uneven tone, and a dull complexion. Chemical peels, lasers, and medical-grade skincare fade pigmentation and restore brightness.",
    details: {
      signs: "Brown spots, sun spots, blotchy or uneven skin tone, freckling, and overall dullness.",
      causes: "UV exposure, hormonal changes, and inflammation that stimulate excess melanin production.",
      candidate: "Adults with sun spots, melasma, or uneven pigmentation seeking a brighter, more even complexion.",
      results: "Visibly brighter, more even-toned skin after a tailored series of resurfacing treatments.",
      treatment_areas: "Face, neck, chest, hands, and other sun-exposed areas.",
      injectables: "Pigment concerns are treated with resurfacing and topical regimens rather than injectables.",
      benefits: "A clearer, more radiant complexion and improved skin health.",
      prevention: "Daily SPF and antioxidant skincare prevent recurrence.",
    },
  },
  {
    name: "Skin Laxity & Sagging",
    triggers: ["laxity", "sagging", "tighten", "lift", "rf microneedling", "endolift", "thread", "pdo", "nightlase", "tightening"],
    serviceKeywords: ["rf microneedling", "endolift", "thread", "pdo", "nightlase", "skin tightening", "everesse", "morpheus", "sculptra", "microneedling"],
    excludeKeywords: ["vaginal", "incontilase", "prolaplase", "lichenlase"],
    imageKeywords: ["thread", "pdo", "sculptra", "morpheus", "endolift", "everesse", "nightlase", "microneedl"],
    overview:
      "Loss of skin firmness leads to sagging along the jawline, neck, and cheeks. Energy-based skin tightening, threads, and collagen-stimulating treatments restore a firmer, lifted appearance.",
    details: {
      signs: "Loose skin along the jawline and neck, jowling, and reduced firmness on the face and body.",
      causes: "Collagen and elastin decline, aging, weight changes, and gravity.",
      candidate: "Adults with mild to moderate skin laxity who want non-surgical tightening and lift.",
      results: "Gradual firming and lifting as new collagen forms over the weeks following treatment.",
      treatment_areas: "Jawline, neck, cheeks, brows, and body areas with loose skin.",
      injectables: "Biostimulators and PDO threads support lift; energy devices tighten tissue.",
      benefits: "A firmer, more contoured, naturally lifted appearance without surgery.",
      prevention: "Ongoing collagen-stimulating treatments help maintain firmness.",
    },
  },
  {
    name: "Unwanted Hair",
    triggers: ["hair removal", "laser hair", "unwanted hair"],
    serviceKeywords: ["laser hair removal", "hair removal"],
    imageKeywords: ["hair", "laserhair", "laser-hair"],
    overview:
      "Laser hair removal offers a long-term reduction in unwanted hair with smoother skin and less irritation than shaving or waxing.",
    details: {
      signs: "Unwanted hair on the face or body, ingrown hairs, and irritation from shaving or waxing.",
      causes: "Genetics and hormones determine hair growth patterns and density.",
      candidate: "Anyone seeking long-term reduction of unwanted hair on the face or body.",
      results: "Significant, lasting hair reduction after a series of treatment sessions.",
      treatment_areas: "Face, underarms, legs, back, bikini area, and other body regions.",
      injectables: "Treated with laser energy rather than injectables.",
      benefits: "Smoother skin, fewer ingrowns, and freedom from routine shaving and waxing.",
      prevention: "Maintenance sessions keep treated areas smooth over time.",
    },
  },
  {
    name: "Double Chin & Submental Fullness",
    triggers: ["kybella", "double chin", "submental", "chin fat"],
    serviceKeywords: ["kybella", "liquid lipo"],
    imageKeywords: ["kybella", "lipo", "submental", "chin"],
    overview:
      "Submental fullness — the 'double chin' — can persist despite diet and exercise. Injectable fat-dissolving treatments permanently reduce fat beneath the chin for a sculpted profile.",
    details: {
      signs: "Fullness or a 'double chin' beneath the jaw, even at a healthy weight.",
      causes: "Genetics, aging, and weight changes that lead to stubborn submental fat.",
      candidate: "Adults bothered by fullness under the chin who want a non-surgical contouring option.",
      results: "A more defined, sculpted jaw and chin profile after a series of treatments.",
      treatment_areas: "The submental area beneath the chin and jawline.",
      injectables: "Kybella® (deoxycholic acid) permanently destroys treated fat cells.",
      benefits: "A slimmer, more contoured profile without surgery.",
      prevention: "Results are long-lasting once the desired contour is achieved.",
    },
  },
];
