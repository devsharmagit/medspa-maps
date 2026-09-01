import { NextResponse } from "next/server";

import { getFeaturedClinics } from "@/lib/clinics/featured";
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
    `- [Treatments](${absoluteUrl("/treatments")}): Browse the aesthetic treatments offered across the directory.`,
    `- [Conditions](${absoluteUrl("/conditions")}): Skin and aesthetic concerns, and the med spas that treat them.`,
    `- [Providers](${absoluteUrl("/providers")}): Aesthetic providers featured across listed practices.`,
    `- [Blog](${absoluteUrl("/blog")}): Expert, plain-English treatment guides.`,
    "",
  ];

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
