import Image from "next/image";

import { Footer } from "@/components/footer";
import { BlogFaqSection } from "@/components/blog/blog-faq";
import { KeyTakeaways } from "@/components/blog/key-takeaways";
import { Markdown } from "@/components/blog/markdown";
import { RecentPosts } from "@/components/blog/recent-posts";
import { TableOfContents } from "@/components/blog/table-of-contents";
import { TreatmentPractices } from "@/components/blog/treatment-practices";
import { JsonLd } from "@/components/shared/json-ld";
import { faqPageJsonLd } from "@/lib/seo/json-ld";
import { ListingHero } from "@/components/shared/listing-hero";
import { MedicalDisclaimer } from "@/components/shared/medical-disclaimer";
import { formatBlogDate } from "@/lib/blog/format";
import type { BlogPostMeta } from "@/lib/blog/posts";
import { extractToc } from "@/lib/blog/toc";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";

export function BlogArticle({
  post,
  body,
  recentPosts,
}: {
  post: BlogPostMeta;
  body: string;
  recentPosts: BlogPostMeta[];
}) {
  const url = absoluteUrl(`/blog/${post.slug}`);

  // The practices sidebar reuses the post's CTA target (e.g. "q=laser-skin-resurfacing"
  // or "condition=hyperpigmentation") to query the same search engine.
  const apiQuery = post.cta.href.includes("?") ? post.cta.href.split("?")[1] : "";

  const toc = extractToc(body);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: post.title,
        description: post.description,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        image: [absoluteUrl(post.heroImage)],
        inLanguage: "en-US",
        datePublished: post.datePublished,
        dateModified: post.dateModified,
        author: { "@type": "Organization", name: post.author, url: SITE_URL },
        publisher: {
          "@type": "Organization",
          name: SITE_NAME,
          logo: {
            "@type": "ImageObject",
            url: absoluteUrl("/images/hero/logo.png"),
          },
        },
      },
      // BreadcrumbList is emitted by <ListingHero> — don't duplicate it here.
      { ...faqPageJsonLd(post.faqs), "@id": `${url}#faq` },
    ],
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#faf7fb] text-zinc-950">
      <JsonLd data={jsonLd} />

      <ListingHero
        crumbs={[
          { label: "Home", href: "/" },
          { label: "Blog", href: "/blog" },
          { label: post.title },
        ]}
        title={post.title}
        contentClassName="max-w-[1200px]"
      >
        <p className="font-montserrat text-[13px] text-zinc-500 sm:text-[14px]">
          By <span className="font-medium text-zinc-700">{post.author}</span>
          <span className="mx-2 text-zinc-300">·</span>
          Updated {formatBlogDate(post.dateModified)}
          <span className="mx-2 text-zinc-300">·</span>
          {post.readingMinutes} min read
        </p>
      </ListingHero>

      <div className="mx-auto w-full max-w-[1200px] px-4 pb-16 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
          {/* Left: the article */}
          <article
            className="min-w-0"
            style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
          >
            {/* Hero image */}
            <figure className="relative">
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[18px] border border-[#F0E2EC] bg-[#F3E5F5] sm:aspect-[16/8]">
                <Image
                  src={post.heroImage}
                  alt={post.heroAlt}
                  fill
                  priority
                  sizes="(min-width: 1024px) 800px, 100vw"
                  className="object-cover"
                />
              </div>
              {post.heroCredit && (
                <figcaption className="mt-2 text-right text-[12px] text-zinc-400">
                  Photo:{" "}
                  <a
                    href={post.heroCredit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-[#CF5B9D]"
                  >
                    {post.heroCredit.name}
                  </a>
                </figcaption>
              )}
            </figure>

            <div className="pt-8">
              <KeyTakeaways items={post.keyTakeaways} />

              <div className="mt-2">
                <Markdown>{body}</Markdown>
              </div>

              <MedicalDisclaimer />

              <BlogFaqSection faqs={post.faqs} />
            </div>
          </article>

          {/* Right: sidebar — recent articles + practices for this treatment */}
          <aside className="lg:sticky lg:top-[110px] lg:self-start">
            <div className="flex flex-col gap-6">
              <TableOfContents items={toc} />
              <RecentPosts posts={recentPosts} />
              <TreatmentPractices
                apiQuery={apiQuery}
                searchHref={post.cta.href}
                ctaLabel={post.cta.label}
              />
            </div>
          </aside>
        </div>
      </div>

      <Footer />
    </main>
  );
}
