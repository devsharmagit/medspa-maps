import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LandingPage } from "@/components/landing/landing-page";
import { allConditionSlugs, getConditionPage } from "@/lib/landing/conditions";
import { SITE_NAME } from "@/lib/site";
import { DEFAULT_OG_IMAGE } from "@/lib/seo/metadata";

// Fully prerendered: all slugs are known at build from the content registry.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return allConditionSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const content = getConditionPage(slug);
  if (!content) return {};

  const path = `/condition/${slug}`;
  const ogImg = content.hero?.src
    ? { url: content.hero.src, alt: content.hero.alt || content.metaTitle }
    : DEFAULT_OG_IMAGE;

  return {
    title: content.metaTitle,
    description: content.metaDescription,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      locale: "en_US",
      title: content.metaTitle,
      description: content.metaDescription,
      url: path,
      siteName: SITE_NAME,
      images: [ogImg],
    },
    twitter: {
      card: "summary_large_image",
      title: content.metaTitle,
      description: content.metaDescription,
      images: [typeof ogImg === "string" ? ogImg : ogImg.url],
    },
  };
}

export default async function ConditionLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = getConditionPage(slug);
  if (!content) notFound();

  return <LandingPage content={content} />;
}
