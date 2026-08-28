import { Suspense } from "react";
import type { Metadata } from "next";
import { SearchResults, type InitialSearchData } from "./search-results";
import { HeroHeader } from "@/components/hero/hero-header";
import { Footer } from "@/components/footer";
import { searchClinics } from "@/lib/search/query";
import { resolveSearchQuery } from "@/lib/search/resolve-query";
import { toStateName } from "@/lib/location/states";
import { SITE_NAME } from "@/lib/site";

// Reads request search params, so this route renders dynamically per request —
// the first result page is server-rendered into the HTML for crawlers/AI bots.
export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const GENERIC_TITLE = "Search Results | Med Spa Maps";
const GENERIC_DESCRIPTION =
  "Find the best med spas and aesthetic practices near you. Compare ratings, treatments, and locations.";

function firstParam(
  sp: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? "";
  return "";
}

/** The URLSearchParams the search engine reads (first page; never pins mode). */
function buildSearchParams(
  sp: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of [
    "q",
    "condition",
    "location",
    "sort",
    "radius",
    "rating",
    "page",
    "lat",
    "lng",
    "tier",
  ]) {
    const v = firstParam(sp, key);
    if (v) params.set(key, v);
  }
  return params;
}

function prettifySlug(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const sp = await searchParams;
  const qRaw = firstParam(sp, "q");
  const conditionRaw = firstParam(sp, "condition");
  const locationRaw = firstParam(sp, "location");

  // Nothing to specialize on → keep the generic (still-indexable) copy.
  if (!qRaw && !conditionRaw && !locationRaw) {
    return { title: GENERIC_TITLE, description: GENERIC_DESCRIPTION };
  }

  let treatmentName = "";
  let conditionName = "";
  let unresolved = false;

  if (conditionRaw) {
    const r = await resolveSearchQuery(conditionRaw);
    conditionName = r.kind !== "unresolved" ? r.name : prettifySlug(conditionRaw);
  } else if (qRaw) {
    const r = await resolveSearchQuery(qRaw);
    if (r.kind === "treatment") treatmentName = r.name;
    else if (r.kind === "concern") conditionName = r.name;
    else unresolved = true; // named nothing real → empty, thin permutation
  }

  const stateName = toStateName(locationRaw);
  const locationLabel = stateName ?? locationRaw;
  const inLocation = locationLabel ? ` in ${locationLabel}` : "";

  let base: string;
  let description: string;
  if (treatmentName) {
    base = `${treatmentName} Providers`;
    description = `Find and compare ${treatmentName} providers${inLocation || " near you"}. See ratings, treatments offered, and book with confidence on ${SITE_NAME}.`;
  } else if (conditionName) {
    base = `Med Spas Treating ${conditionName}`;
    description = `Find med spas that treat ${conditionName}${inLocation || " near you"}. Compare ratings, treatments, and locations on ${SITE_NAME}.`;
  } else {
    base = "Best Med Spas";
    description = `Find the best med spas${inLocation || " near you"}. Compare ratings, treatments, and locations on ${SITE_NAME}.`;
  }

  const title = `${base}${inLocation} | Med Spa Maps`;

  // Canonical: the indexable facets only (q / condition / location), stable
  // order — drops session noise like lat/lng/sort/page/rating.
  const canonicalParams = new URLSearchParams();
  if (qRaw) canonicalParams.set("q", qRaw);
  if (conditionRaw) canonicalParams.set("condition", conditionRaw);
  if (locationRaw) canonicalParams.set("location", locationRaw);
  const canonicalQs = canonicalParams.toString();
  const canonical = canonicalQs ? `/search?${canonicalQs}` : "/search";

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      siteName: SITE_NAME,
    },
    // A treatment-box query that names nothing real returns no clinics — don't
    // let those empty permutations into the index.
    ...(unresolved ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;

  // Server-render the first page of results so the HTML carries real listings.
  // A DB hiccup falls back to the client fetch (no initialData) rather than 500ing.
  let initialData: InitialSearchData | undefined;
  try {
    const data = await searchClinics(buildSearchParams(sp));
    initialData = {
      results: data.results as unknown as InitialSearchData["results"],
      total: data.total,
      resolved: data.query.resolved,
      pagination: data.pagination,
    };
  } catch (err) {
    console.error("Search page SSR failed; falling back to client fetch:", err);
    initialData = undefined;
  }

  return (
    <main className="relative flex min-h-screen flex-col bg-[#FDFDFD]">
      {/* Hero header band */}
      <div className="bg-hero-gradient">
        <HeroHeader />
      </div>

      {/* Search results content */}
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center py-32">
            <div className="flex flex-col items-center gap-4">
              <div className="size-10 animate-spin rounded-full border-4 border-brand-magenta/20 border-t-brand-magenta" />
              <p className="text-sm text-brand-muted">Searching practices…</p>
            </div>
          </div>
        }
      >
        <SearchResults initialData={initialData} />
      </Suspense>

      <Footer />
    </main>
  );
}
