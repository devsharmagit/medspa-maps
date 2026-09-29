import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { HeroHeader } from "@/components/hero/hero-header";
import { SkinNavigatorClient } from "./skin-navigator-client";

import { DEFAULT_OG_IMAGE, DEFAULT_TWITTER_IMAGE } from "@/lib/seo/metadata";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "AI Aesthetic Treatment Finder — Medspa Maps",
  description:
    "Answer a few quick questions to find personalized aesthetic treatments tailored to your goals.",
  alternates: { canonical: "/ai-aesthetic-treatment-finder" },
  openGraph: {
    type: "website",
    title: "AI Aesthetic Treatment Finder — Medspa Maps",
    description:
      "Answer a few quick questions to find personalized aesthetic treatments tailored to your goals.",
    url: `${SITE_URL}/ai-aesthetic-treatment-finder`,
    siteName: SITE_NAME,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Aesthetic Treatment Finder — Medspa Maps",
    description:
      "Answer a few quick questions to find personalized aesthetic treatments tailored to your goals.",
    images: [DEFAULT_TWITTER_IMAGE],
  },
};

export const dynamic = "force-dynamic";

export default function SkinNavigatorPage() {
  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-x-clip bg-[#fbfbfb]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[690px] overflow-hidden bg-[#2f1832] sm:h-[560px]" aria-hidden>
        <div className="absolute inset-0 bg-hero-gradient opacity-95" />
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-multiply"
          style={{ backgroundImage: "url('/images/hero/bg-overlay-1.webp')" }}
        />
        <div className="absolute inset-0 bg-black/35" />
      </div>
      <HeroHeader />
      <SkinNavigatorClient />
      <Footer />
    </main>
  );
}
