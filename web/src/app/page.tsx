import { Footer } from "@/components/footer";
import { FindClinicSection } from "@/components/hero/find-clinic-section";
import { HeroSection } from "@/components/hero/hero-section";
import { HowItWorks } from "@/components/hero/how-it-works";
import { PopularTreatments } from "@/components/hero/popular-treatments";
import { ProvidersSpotlight } from "@/components/hero/providers-spotlight";
import { TopCities } from "@/components/hero/top-cities";
import { ArticleSection } from "@/components/hero/article-section";
import { FaqSection } from "@/components/hero/faq-section";
import StatsSection from "@/components/hero/stat-section";
import { getFeaturedClinics } from "@/lib/clinics/featured";
import { SPOTLIGHT_PROVIDERS } from "@/lib/providers/spotlight-static";
import { getRecentPosts } from "@/lib/blog";
import { formatBlogMeta } from "@/lib/blog/format";
import { JsonLd } from "@/components/shared/json-ld";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { DEFAULT_OG_IMAGE, DEFAULT_TWITTER_IMAGE } from "@/lib/seo/metadata";
import type { Metadata } from "next";

// Homepage-only og:image block, per the SEO spec: adds og:image:secure_url and
// og:image:type on top of the shared default. Scoped here rather than added to
// DEFAULT_OG_IMAGE so the other routes are unaffected.
const HOMEPAGE_OG_IMAGE = {
  ...DEFAULT_OG_IMAGE,
  secureUrl: DEFAULT_OG_IMAGE.url,
  type: "image/png",
};

export const metadata: Metadata = {
  title: "Medspa Maps - Find the Right Local Medspa",
  description:
    "Explore 600+ vetted medspas, read expert treatment guides, and book with confidence.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "Medspa Maps - Find the Right Local Medspa",
    description:
      "Explore 600+ vetted medspas, read expert treatment guides, and book with confidence.",
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [HOMEPAGE_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Medspa Maps - Find the Right Local Medspa",
    description:
      "Explore 600+ vetted medspas, read expert treatment guides, and book with confidence.",
    images: [DEFAULT_TWITTER_IMAGE],
  },
};

const homepageJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      logo: {
        "@type": "ImageObject",
        "@id": `${SITE_URL}/#logo`,
        url: `${SITE_URL}/images/hero/logo.png`,
        contentUrl: `${SITE_URL}/images/hero/logo.png`,
      },
      image: {
        "@type": "ImageObject",
        url: DEFAULT_OG_IMAGE.url,
        contentUrl: DEFAULT_OG_IMAGE.url,
      },
      areaServed: [
        { "@type": "Country", name: "United States" },
        { "@type": "Country", name: "United Kingdom" },
        { "@type": "Country", name: "Canada" },
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      description:
        "Explore 600+ vetted medspas, read expert treatment guides, and book with confidence.",
      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },
      image: {
        "@type": "ImageObject",
        url: DEFAULT_OG_IMAGE.url,
        contentUrl: DEFAULT_OG_IMAGE.url,
      },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
        },
        "query-input": {
          "@type": "PropertyValueSpecification",
          valueRequired: true,
          valueName: "search_term_string",
        },
      },
    },
    {
      "@type": "WebPage",
      "@id": `${SITE_URL}/#webpage`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      description:
        "Explore 600+ vetted medspas, read expert treatment guides, and book with confidence.",
      isPartOf: {
        "@id": `${SITE_URL}/#website`,
      },
      about: {
        "@id": `${SITE_URL}/#organization`,
      },
      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },
      primaryImageOfPage: {
        "@type": "ImageObject",
        url: DEFAULT_OG_IMAGE.url,
        contentUrl: DEFAULT_OG_IMAGE.url,
      },
      inLanguage: "en",
    },
  ],
};

// Queries the database, so it can't be prerendered at Docker build time —
// env (DATABASE_URL etc.) is only injected at runtime via ECS Secrets Manager.
export const dynamic = "force-dynamic";

export default async function Home() {
  const featuredClinics = await getFeaturedClinics(5);
  // Static owner-of-each-featured-clinic list (no runtime query) — see
  // src/lib/providers/spotlight-static.ts.
  const spotlightProviders = SPOTLIGHT_PROVIDERS;
  // Latest blog posts for the "From the blog" section (registry-only; no query).
  const latestPosts = getRecentPosts(3).map((post) => ({
    slug: post.slug,
    category: post.category,
    title: post.title,
    meta: formatBlogMeta(post.datePublished, post.readingMinutes),
    image: post.heroImage,
    alt: post.heroAlt,
  }));
  console.log("home page");

  return (
    <main className="relative flex flex-1 flex-col items-center bg-[#FDFDFD] gap-10 isolate w-full overflow-x-clip">
      <JsonLd data={homepageJsonLd} />

      {/* Page-wide Background Image rendered as CSS background instead of <img> */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-cover bg-center opacity-20"
        style={{ backgroundImage: "url('/images/landingpage/whole-bg-png.webp')" }}
        aria-hidden="true"
      />

      <HeroSection />
      <StatsSection />
      <PopularTreatments />
      <FindClinicSection clinics={featuredClinics} />
      <ProvidersSpotlight providers={spotlightProviders} />
      <HowItWorks />
      <TopCities />
      <ArticleSection posts={latestPosts} />
      <FaqSection />
      <Footer showListingCta />
    </main>
  );
}
