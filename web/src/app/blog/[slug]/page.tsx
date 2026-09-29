import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlogArticle } from "@/components/blog/blog-article";
import { getAllSlugs, getPostBody, getPostMeta, getRelatedPosts } from "@/lib/blog";
import { SITE_NAME, absoluteUrl } from "@/lib/site";
import { DEFAULT_OG_IMAGE } from "@/lib/seo/metadata";

// Fully prerendered: all slugs are known at build, so the only filesystem read
// (the markdown body) happens at build time, never per-request.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

const BLOG_HERO_DIMENSIONS: Record<string, { width: number; height: number }> = {
  "/images/blog/dermal-fillers-101-hero.jpeg": { width: 2262, height: 1508 },
  "/images/blog/hyperpigmentation-treatments-hero.jpeg": { width: 5632, height: 3072 },
  "/images/blog/laser-skin-treatments-explained-hero.jpeg": { width: 5523, height: 3682 },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostMeta(slug);
  if (!post) return {};

  const path = `/blog/${post.slug}`;
  const dims = post.heroImage ? BLOG_HERO_DIMENSIONS[post.heroImage] : undefined;
  const ogImg = post.heroImage
    ? {
        url: absoluteUrl(post.heroImage),
        width: dims?.width ?? 1200,
        height: dims?.height ?? 630,
        alt: post.heroAlt || post.title,
      }
    : DEFAULT_OG_IMAGE;

  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      locale: "en_US",
      title: post.title,
      description: post.description,
      url: path,
      siteName: SITE_NAME,
      images: [ogImg],
      publishedTime: post.datePublished,
      modifiedTime: post.dateModified,
      authors: [post.author],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [typeof ogImg === "string" ? ogImg : ogImg.url],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostMeta(slug);
  if (!post) notFound();

  const body = getPostBody(slug);
  const recentPosts = getRelatedPosts(slug, 3);

  return <BlogArticle post={post} body={body} recentPosts={recentPosts} />;
}
