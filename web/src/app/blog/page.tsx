import type { Metadata } from "next";

import { BlogCard } from "@/components/blog/blog-card";
import { Footer } from "@/components/footer";
import { JsonLd } from "@/components/shared/json-ld";
import { ListingHero } from "@/components/shared/listing-hero";
import { getAllPosts } from "@/lib/blog";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";

const DESCRIPTION =
  "Beginner friendly guides to popular medspa treatments, from Botox and fillers to laser skin treatments and everyday skincare, so you know exactly what to expect before you book.";

export const metadata: Metadata = {
  title: `Blog — ${SITE_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: "/blog" },
  openGraph: {
    type: "website",
    title: `Blog — ${SITE_NAME}`,
    description: DESCRIPTION,
    url: "/blog",
    siteName: SITE_NAME,
  },
};

export default function BlogIndexPage() {
  const posts = getAllPosts();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        "@id": `${absoluteUrl("/blog")}#blog`,
        name: `${SITE_NAME} Blog`,
        description: DESCRIPTION,
        url: absoluteUrl("/blog"),
        blogPost: posts.map((p) => ({
          "@type": "BlogPosting",
          headline: p.title,
          url: absoluteUrl(`/blog/${p.slug}`),
          datePublished: p.datePublished,
          dateModified: p.dateModified,
        })),
      },
      // BreadcrumbList is emitted by <ListingHero> — don't duplicate it here.
    ],
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#faf7fb] text-zinc-950">
      <JsonLd data={jsonLd} />

      <ListingHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Blog" }]}
        title="From the"
        accent="blog"
        subtitle={DESCRIPTION}
      />

      <div className="mx-auto w-full max-w-[1400px] px-4 pb-16 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <BlogCard key={post.slug} post={post} />
          ))}
        </div>
      </div>

      <Footer />
    </main>
  );
}
