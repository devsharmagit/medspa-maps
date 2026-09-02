/**
 * Types for the data-driven treatment/condition landing pages
 * (`/treatment/[slug]` and `/condition/[slug]`).
 *
 * Content is transcribed from the client's `pages-docs/*.docx`. The template is
 * intentionally flexible, not rigid: a page renders only the fields it has, so
 * different pages can differ (some have tables, some have images, etc.). Images
 * are kept to ~2–3 per page and left blank (`src` undefined) so the template
 * renders a branded placeholder; swapping in a real image later is a one-field
 * edit per slot.
 */

/** An image slot. `src` empty → the template renders a branded placeholder. */
export interface ImageSlot {
  /** Local `/images/...` path (or allow-listed remote). Empty → placeholder. */
  src?: string;
  /** Alt text (also used as the placeholder's caption). Always author this. */
  alt: string;
}

export interface LandingTable {
  headers: string[];
  rows: string[][];
}

/**
 * A content section. Renders whatever fields are present: paragraphs, a bullet
 * list ("Label: text" bolds the label), a table, a pull-quote, and/or a
 * full-width image. Sections with none of these are skipped.
 */
export interface LandingSection {
  id: string;
  heading: string;
  headingAccent?: string;
  body?: string[];
  bullets?: string[];
  pullQuote?: string;
  table?: LandingTable;
  image?: ImageSlot;
}

export interface LandingFaq {
  q: string;
  a: string;
}

export interface LandingContent {
  kind: "treatment" | "condition";
  /** URL slug, e.g. "botox" → /treatment/botox, "wrinkles" → /condition/wrinkles. */
  slug: string;
  /** The full <h1> / page title (from the doc). */
  title: string;
  /** Short noun for the breadcrumb and CTA labels, e.g. "Botox". */
  shortName: string;
  /** <title> — include the " | Med Spa Maps" suffix. */
  metaTitle: string;
  metaDescription: string;
  /** Human display, e.g. "August 2026". */
  updated: string;
  datePublishedISO: string;
  dateModifiedISO: string;
  /** Optional blog-style lead image at the top of the article. */
  hero?: ImageSlot;
  /** Quick-facts bullets shown in the "At a glance" card. */
  atGlance: string[];
  sections: LandingSection[];
  /** "What to look for in a provider" block. */
  provider: { intro: string[]; tips: string[] };
  faqs: LandingFaq[];
  /** Primary CTA deep-link into search. */
  searchCta: { label: string; href: string };
  /**
   * Extra search values (beyond searchCta/slug/shortName) that should also
   * surface this page's FAQs on /search — e.g. veins covers both the
   * `spider-veins` and `varicose-veins` concern slugs.
   */
  searchAliases?: { conditions?: string[]; queries?: string[] };
  /** Drives the JSON-LD `about` node. */
  schemaAbout: { type: "MedicalProcedure" | "MedicalCondition"; name: string };
}
