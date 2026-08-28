import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BlogArticle } from "@/components/blog/blog-article";
import { getAllSlugs, getPostBody, getPostMeta, getRelatedPosts } from "@/lib/blog";
import { SITE_NAME } from "@/lib/site";

// Fully prerendered: all slugs are known at build, so the only filesystem read
// (the markdown body) happens at build time, never per-request.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostMeta(slug);
  if (!post) return {};

  const path = `/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url: path,
      siteName: SITE_NAME,
      images: [{ url: post.heroImage, alt: post.heroAlt }],
      publishedTime: post.datePublished,
      modifiedTime: post.dateModified,
      authors: [post.author],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [post.heroImage],
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
  const related = getRelatedPosts(slug, 2);

  return <BlogArticle post={post} body={body} related={related} />;
}
