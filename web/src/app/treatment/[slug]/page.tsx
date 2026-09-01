import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LandingPage } from "@/components/landing/landing-page";
import { allTreatmentSlugs, getTreatmentPage } from "@/lib/landing/treatments";
import { SITE_NAME } from "@/lib/site";

// Fully prerendered: all slugs are known at build from the content registry.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return allTreatmentSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const content = getTreatmentPage(slug);
  if (!content) return {};

  const path = `/treatment/${slug}`;
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

export default async function TreatmentLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = getTreatmentPage(slug);
  if (!content) notFound();

  return <LandingPage content={content} />;
}
