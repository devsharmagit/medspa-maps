import { TOP_STATES, type TopState } from "@/data/top-states";

// Editorial content + slug resolution for the 12 state landing pages.
// Intros/metas are UNIQUE per state, evergreen, and contain NO pricing. Volatile
// facts (clinic counts, cities) are injected at render, never baked in here.

/** "New York" → "new-york". */
export function stateSlug(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, "-");
}

const BY_SLUG = new Map(TOP_STATES.map((s) => [stateSlug(s.state), s] as const));

/** Resolve a URL slug to one of the 12 top states, or null. */
export function stateFromSlug(slug: string): TopState | null {
  return BY_SLUG.get(slug.toLowerCase()) ?? null;
}

/** The 12 slugs, for the sitemap + homepage links. */
export function allStateSlugs(): string[] {
  return TOP_STATES.map((s) => stateSlug(s.state));
}

export interface StateFaq {
  q: string;
  a: string;
}

export interface StateContent {
  /** Unique, evergreen intro paragraph. No pricing, no volatile numbers. */
  intro: string;
  /** Unique meta description (~150 chars). No pricing. */
  metaDescription: string;
  /** Optional state-flavored extra FAQs (evergreen, no pricing). */
  extraFaqs?: StateFaq[];
}

/** Keyed by 2-letter state code. */
export const STATE_CONTENT: Record<string, StateContent> = {
  TX: {
    intro:
      "Texas has one of the largest and fastest-growing medical aesthetics scenes in the country. From Houston and Dallas–Fort Worth to Austin and San Antonio, experienced injectors, laser specialists, and skin experts run modern med spas across the state — so whether you're after neurotoxin, filler, laser treatments, or medical-grade skincare, you'll find deep choice close to home.",
    metaDescription:
      "Explore vetted med spas across Texas — Houston, Dallas, Austin, San Antonio and beyond. Compare treatments, ratings, and locations on Med Spa Maps.",
    extraFaqs: [
      {
        q: "Which Texas cities have the most med spas?",
        a: "Houston, Dallas–Fort Worth, Austin, and San Antonio anchor Texas's aesthetics scene, but vetted med spas also operate in mid-size cities across the state.",
      },
    ],
  },
  CA: {
    intro:
      "California helped define modern medical aesthetics, and its med spa scene reflects that. Los Angeles, Orange County, San Diego, and the San Francisco Bay Area are home to highly regarded injectors, laser clinics, and skin-health practices, with a strong emphasis on natural-looking, results-driven care — from injectables to advanced laser and skin treatments.",
    metaDescription:
      "Find vetted med spas across California — Los Angeles, San Diego, the Bay Area, and Orange County. Compare treatments, ratings, and locations on Med Spa Maps.",
    extraFaqs: [
      {
        q: "Where are California's top med spas?",
        a: "Los Angeles, Orange County, San Diego, and the San Francisco Bay Area concentrate much of California's medical aesthetics talent, though vetted med spas are found statewide.",
      },
    ],
  },
  FL: {
    intro:
      "Florida's sunny, image-conscious culture has made it one of the busiest states for medical aesthetics. Miami, Orlando, Tampa, and Jacksonville host a wide range of med spas — from injectable specialists to laser and skin-rejuvenation experts — many focused on sun-damage repair and year-round skin health.",
    metaDescription:
      "Discover vetted med spas across Florida — Miami, Orlando, Tampa, Jacksonville and more. Compare treatments, ratings, and locations on Med Spa Maps.",
    extraFaqs: [
      {
        q: "What med spa treatments are popular in Florida?",
        a: "With year-round sun, Florida med spas often focus on laser treatments and skin rejuvenation alongside injectables and medical-grade skincare.",
      },
    ],
  },
  NY: {
    intro:
      "New York sets trends in beauty and aesthetics, and its med spas are no exception. Manhattan and the greater New York City area lead with experienced injectors and advanced laser and skin practices, while med spas across Long Island, Westchester, and upstate offer the same medical-grade care closer to home.",
    metaDescription:
      "Browse vetted med spas across New York — Manhattan, Long Island, Westchester, and upstate. Compare treatments, ratings, and locations on Med Spa Maps.",
    extraFaqs: [
      {
        q: "Are there med spas outside New York City?",
        a: "Yes — beyond Manhattan and the boroughs, vetted med spas operate across Long Island, Westchester, and upstate cities like Buffalo and Rochester.",
      },
    ],
  },
  UT: {
    intro:
      "Utah has quietly become one of the country's most active med spa markets for its size. The Salt Lake City, Lehi, and Provo corridor along the Wasatch Front is dense with skilled injectors and skin-care practices, offering a full range of injectable, laser, and skin treatments.",
    metaDescription:
      "Find vetted med spas across Utah — Salt Lake City, Lehi, Provo, and the Wasatch Front. Compare treatments, ratings, and locations on Med Spa Maps.",
    extraFaqs: [
      {
        q: "Why does Utah have so many med spas?",
        a: "Utah's Wasatch Front — Salt Lake City, Lehi, and Provo — supports an unusually dense, competitive medical aesthetics scene relative to its population.",
      },
    ],
  },
  AZ: {
    intro:
      "Arizona's med spa scene centers on the Phoenix–Scottsdale metro, long known as a destination for aesthetics and wellness, with Tucson and other cities adding to the mix. The desert climate puts a premium on sun-conscious skin care, and Arizona med spas offer injectables, laser treatments, and skin-health programs to match.",
    metaDescription:
      "Explore vetted med spas across Arizona — Phoenix, Scottsdale, Tucson, and beyond. Compare treatments, ratings, and locations on Med Spa Maps.",
    extraFaqs: [
      {
        q: "Where are the best med spas in Arizona?",
        a: "Scottsdale and greater Phoenix are Arizona's aesthetics hub, with additional vetted med spas in Tucson and other cities across the state.",
      },
    ],
  },
  GA: {
    intro:
      "Georgia's medical aesthetics scene is anchored by metro Atlanta, one of the Southeast's fastest-growing markets, with Savannah, Augusta, and other cities adding options. Georgia med spas span injectables, laser, and skin-rejuvenation care delivered by experienced medical providers.",
    metaDescription:
      "Discover vetted med spas across Georgia — Atlanta, Savannah, Augusta, and more. Compare treatments, ratings, and locations on Med Spa Maps.",
    extraFaqs: [
      {
        q: "Which Georgia cities have med spas?",
        a: "Metro Atlanta leads Georgia's med spa scene, with vetted practices also found in Savannah, Augusta, and other cities across the state.",
      },
    ],
  },
  PA: {
    intro:
      "Pennsylvania offers a deep med spa landscape across two major metros — Philadelphia in the east and Pittsburgh in the west — plus growing options in cities like Allentown and Harrisburg. Pennsylvania med spas provide the full range of injectable, laser, and skin treatments under medical supervision.",
    metaDescription:
      "Browse vetted med spas across Pennsylvania — Philadelphia, Pittsburgh, and beyond. Compare treatments, ratings, and locations on Med Spa Maps.",
    extraFaqs: [
      {
        q: "Where are med spas located in Pennsylvania?",
        a: "Philadelphia and Pittsburgh anchor Pennsylvania's med spa scene, with additional vetted practices in cities like Allentown, Harrisburg, and their suburbs.",
      },
    ],
  },
  TN: {
    intro:
      "Tennessee's med spa scene has grown quickly alongside cities like Nashville, Memphis, Knoxville, and Chattanooga. From injectable specialists to laser and skin-care experts, Tennessee med spas deliver medical-grade aesthetics across the state.",
    metaDescription:
      "Find vetted med spas across Tennessee — Nashville, Memphis, Knoxville, and Chattanooga. Compare treatments, ratings, and locations on Med Spa Maps.",
    extraFaqs: [
      {
        q: "Which Tennessee cities have the most med spas?",
        a: "Nashville leads Tennessee's med spa growth, with strong options in Memphis, Knoxville, and Chattanooga as well.",
      },
    ],
  },
  WA: {
    intro:
      "Washington's med spa scene is centered on the Seattle–Bellevue metro, with Spokane and other cities adding choice. Washington med spas emphasize natural-looking results and skin health, offering injectables, laser treatments, and medical-grade skincare.",
    metaDescription:
      "Explore vetted med spas across Washington — Seattle, Bellevue, Spokane, and beyond. Compare treatments, ratings, and locations on Med Spa Maps.",
    extraFaqs: [
      {
        q: "Where are the best med spas in Washington?",
        a: "The Seattle–Bellevue area concentrates most of Washington's med spa talent, with additional vetted practices in Spokane and other cities.",
      },
    ],
  },
  NC: {
    intro:
      "North Carolina's med spa scene spans the Charlotte metro and the Raleigh–Durham Research Triangle — two of the Southeast's fastest-growing regions — plus cities like Greensboro and Asheville. North Carolina med spas offer injectables, laser, and skin-rejuvenation care from experienced providers.",
    metaDescription:
      "Discover vetted med spas across North Carolina — Charlotte, Raleigh, Durham, and more. Compare treatments, ratings, and locations on Med Spa Maps.",
    extraFaqs: [
      {
        q: "Which North Carolina cities have med spas?",
        a: "Charlotte and the Raleigh–Durham Triangle lead North Carolina's med spa scene, with vetted practices also in Greensboro, Asheville, and other cities.",
      },
    ],
  },
  IL: {
    intro:
      "Illinois's med spa scene is anchored by Chicago and its surrounding suburbs, one of the largest metropolitan aesthetics markets in the Midwest. Illinois med spas offer the full range of injectable, laser, and skin treatments, delivered under medical supervision.",
    metaDescription:
      "Browse vetted med spas across Illinois — Chicago and the surrounding suburbs. Compare treatments, ratings, and locations on Med Spa Maps.",
    extraFaqs: [
      {
        q: "Where are med spas located in Illinois?",
        a: "Chicago and its suburbs — including the North Shore, Naperville, and Oak Brook areas — anchor Illinois's med spa scene.",
      },
    ],
  },
};

/** Content for a state code, with a safe generic fallback. */
export function stateContent(abbr: string, stateName: string): StateContent {
  return (
    STATE_CONTENT[abbr] ?? {
      intro: `Explore vetted med spas across ${stateName}. Compare treatments, patient ratings, and locations, then book directly with the practice — all on Med Spa Maps.`,
      metaDescription: `Find vetted med spas across ${stateName}. Compare treatments, ratings, and locations on Med Spa Maps.`,
    }
  );
}
