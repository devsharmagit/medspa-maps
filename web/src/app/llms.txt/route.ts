import { NextResponse } from "next/server";

import { getFeaturedClinics } from "@/lib/clinics/featured";
import { CONDITION_PAGES } from "@/lib/landing/conditions";
import { TREATMENT_PAGES } from "@/lib/landing/treatments";
import { toStateCode } from "@/lib/location/states";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

// llms.txt — an emerging convention giving AI crawlers a clean, curated pointer
// to the site's key content (https://llmstxt.org). Served as markdown text.
// Re-generated hourly so the featured-practice list stays fresh without a hit
// on every crawl.
export const revalidate = 3600;

export async function GET() {
  let featuredLines: string[] = [];
  try {
    const featured = await getFeaturedClinics(10);
    featuredLines = featured.map((c) => {
      const stateCode = c.state ? (toStateCode(c.state) ?? c.state) : null;
      const place = [c.city, stateCode].filter(Boolean).join(", ");
      const rating =
        c.rating != null ? ` — ${c.rating}★ (${c.reviewCount} reviews)` : "";
      const label = place ? `${c.name} — ${place}` : c.name;
      return `- [${label}](${absoluteUrl(`/practices/${c.slug}`)})${rating}`;
    });
  } catch (err) {
    // A DB hiccup shouldn't 500 the crawler file — just omit the dynamic list.
    console.error("llms.txt: failed to load featured clinics:", err);
  }

  const lines = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_NAME} is a free, editorially-vetted directory of med spas across the United States. Every listing pairs the treatments and concerns a practice actually offers with real patient reviews, hours, and location — alongside plain-English treatment guides — so patients can compare practices on facts and book directly.`,
    "",
    "## Key pages",
    `- [Search med spas](${absoluteUrl("/search")}): Find and compare med spas by treatment, concern, or location (e.g. ${absoluteUrl("/search?location=TX")}).`,
    `- [Patients' Favourites](${absoluteUrl("/patients-fav")}): Popular treatment and condition guides patients research most.`,
    `- [Conditions](${absoluteUrl("/conditions")}): Skin and aesthetic concerns, and the med spas that treat them.`,
    `- [Providers](${absoluteUrl("/providers")}): Aesthetic providers featured across listed practices.`,
    `- [Blog](${absoluteUrl("/blog")}): Expert, plain-English treatment guides.`,
    "",
  ];

  const guideLines = [
    ...Object.values(TREATMENT_PAGES).map(
      (c) => `- [${c.h1.lead} guide](${absoluteUrl(`/treatment/${c.slug}`)}): ${c.metaDescription}`,
    ),
    ...Object.values(CONDITION_PAGES).map(
      (c) => `- [${c.h1.lead} guide](${absoluteUrl(`/condition/${c.slug}`)}): ${c.metaDescription}`,
    ),
  ];
  if (guideLines.length) {
    lines.push("## Treatment & condition guides", ...guideLines, "");
  }

  if (featuredLines.length) {
    lines.push("## Featured practices", ...featuredLines, "");
  }

  lines.push(
    "## Sitemap",
    `- ${absoluteUrl("/sitemap.xml")}`,
    "",
  );

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
