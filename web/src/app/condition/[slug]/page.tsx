import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LandingPage } from "@/components/landing/landing-page";
import { allConditionSlugs, getConditionPage } from "@/lib/landing/conditions";
import { SITE_NAME } from "@/lib/site";

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
  return {
    title: content.metaTitle,
    description: content.metaDescription,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      title: content.metaTitle,
      description: content.metaDescription,
      url: path,
      siteName: SITE_NAME,
      ...(content.hero?.src
        ? { images: [{ url: content.hero.src, alt: content.hero.alt }] }
        : {}),
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
