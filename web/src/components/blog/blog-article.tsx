import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

import { Footer } from "@/components/footer";
import { BlogCard } from "@/components/blog/blog-card";
import { BlogFaqSection } from "@/components/blog/blog-faq";
import { KeyTakeaways } from "@/components/blog/key-takeaways";
import { Markdown } from "@/components/blog/markdown";
import { JsonLd } from "@/components/shared/json-ld";
import { faqPageJsonLd } from "@/lib/seo/json-ld";
import { ListingHero } from "@/components/shared/listing-hero";
import { MedicalDisclaimer } from "@/components/shared/medical-disclaimer";
import { Button } from "@/components/ui/button";
import { formatBlogDate } from "@/lib/blog/format";
import type { BlogPostMeta } from "@/lib/blog/posts";
import { SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";

export function BlogArticle({
  post,
  body,
  related,
}: {
  post: BlogPostMeta;
  body: string;
  related: BlogPostMeta[];
}) {
  const url = absoluteUrl(`/blog/${post.slug}`);

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
        contentClassName="max-w-[820px]"
      >
        <p className="font-montserrat text-[13px] text-zinc-500 sm:text-[14px]">
          By <span className="font-medium text-zinc-700">{post.author}</span>
          <span className="mx-2 text-zinc-300">·</span>
          Updated {formatBlogDate(post.dateModified)}
          <span className="mx-2 text-zinc-300">·</span>
          {post.readingMinutes} min read
        </p>
      </ListingHero>

      {/* Hero + article share the exact same centered reading column as the header */}
      <div className="mx-auto w-full max-w-[820px] px-4 sm:px-6">
        {/* Hero image */}
        <figure className="relative">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[18px] border border-[#F0E2EC] bg-[#F3E5F5] sm:aspect-[16/8]">
            <Image
              src={post.heroImage}
              alt={post.heroAlt}
              fill
              priority
              sizes="(min-width: 1400px) 1360px, 100vw"
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

        <article
          className="pb-8 pt-8"
          style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
        >
          <KeyTakeaways items={post.keyTakeaways} />

          <div className="mt-2">
            <Markdown>{body}</Markdown>
          </div>

          <MedicalDisclaimer />

          <BlogFaqSection faqs={post.faqs} />

          {/* Closing CTA into the directory */}
          <section className="mt-14 rounded-[18px] border border-[#DEC6DF] bg-white px-6 py-8 text-center shadow-[0px_8px_14px_rgba(0,0,0,0.02)] sm:px-10">
            <h2 className="font-montserrat text-[22px] font-semibold text-[#373634] sm:text-[26px]">
              Find the right provider for you
            </h2>
            <p className="mx-auto mt-2 max-w-xl font-montserrat text-[15px] leading-[1.6] text-zinc-600">
              Compare qualified med spas near you, read reviews, and book a consultation
              with confidence.
            </p>
            <div className="mt-6 flex justify-center">
              <Button asChild variant="gradient" size="search">
                <Link href={post.cta.href}>
                  <MapPin className="size-[18px]" aria-hidden />
                  {post.cta.label}
                  <ArrowRight className="size-[18px]" aria-hidden />
                </Link>
              </Button>
            </div>
          </section>
        </article>
      </div>

      {/* Related articles — wider grid, centered on the same axis */}
      {related.length > 0 && (
        <div className="mx-auto w-full max-w-[1100px] px-4 sm:px-6">
          <section className="border-t border-[#F0E2EC] pb-16 pt-10">
            <h2 className="font-montserrat text-[22px] font-semibold text-[#373634] sm:text-[26px]">
              Related articles
            </h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {related.map((r) => (
                <BlogCard key={r.slug} post={r} />
              ))}
            </div>
          </section>
        </div>
      )}

      <Footer />
    </main>
  );
}
