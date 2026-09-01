import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";

import { Footer } from "@/components/footer";
import { ListingHero } from "@/components/shared/listing-hero";
import { TREATMENT_PAGES } from "@/lib/landing/treatments";
import { CONDITION_PAGES } from "@/lib/landing/conditions";
import type { LandingContent } from "@/lib/landing/types";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Patients' Favourites: Popular Treatments & Conditions | Med Spa Maps",
  description:
    "The treatments and conditions our patients research most, with plain-English guides to each — Botox, dermal fillers, facials, laser, microneedling, wrinkles, pigmentation and veins.",
  alternates: { canonical: "/patients-fav" },
  openGraph: {
    type: "website",
    title: "Patients' Favourites: Popular Treatments & Conditions | Med Spa Maps",
    description:
      "The treatments and conditions our patients research most, with plain-English guides to each.",
    url: "/patients-fav",
    siteName: "Med Spa Maps",
  },
};

function FavCard({ content }: { content: LandingContent }) {
  const href = `/${content.kind}/${content.slug}`;
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-[20px] border border-[#F0E2EC] bg-white shadow-[0px_8px_20px_rgba(170,78,179,0.07)] transition-all duration-300 hover:-translate-y-1 hover:border-[#E3CED8] hover:shadow-[0px_18px_40px_rgba(123,45,107,0.16)]"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[linear-gradient(144deg,#F5F0F7,#ffffff)]">
        {content.hero?.src && (
          <Image
            src={content.hero.src}
            alt={content.hero.alt}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
        <h3 className="absolute inset-x-4 bottom-3 font-montserrat text-[19px] font-semibold leading-tight text-white drop-shadow-sm">
          {content.shortName}
        </h3>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="mb-5 line-clamp-3 flex-1 text-[13.5px] leading-[1.6] text-[#6b6a68]">
          {content.metaDescription}
        </p>
        <span className="mt-auto inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#CF5B9D]">
          Read the guide
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

function FavSection({
  heading,
  accent,
  blurb,
  items,
}: {
  heading: string;
  accent: string;
  blurb: string;
  items: LandingContent[];
}) {
  return (
    <section className="mt-14 first:mt-4">
      <h2 className="font-montserrat text-[26px] font-medium leading-[116%] tracking-[-0.03em] text-[#373634] sm:text-[32px]">
        {heading} <span className="font-fraunces font-normal italic">{accent}</span>
      </h2>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-zinc-600">{blurb}</p>
      <div className="mt-7 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <FavCard key={c.slug} content={c} />
        ))}
      </div>
    </section>
  );
}

export default function PatientsFavouritesPage() {
  const treatments = Object.values(TREATMENT_PAGES);
  const conditions = Object.values(CONDITION_PAGES);

  return (
    <main
      className="flex min-h-screen flex-col bg-[#faf7fb] text-zinc-950"
      style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
    >
      <ListingHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Patients' Favourites" }]}
        title="Patients'"
        accent="Favourites"
        subtitle="The treatments and conditions our patients research most — clear, plain-English guides to each, then find and compare licensed providers near you."
        contentClassName="max-w-[1240px]"
      />

      <div className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-20 sm:px-6">
        <FavSection
          heading="Popular"
          accent="treatments"
          blurb="Non-surgical treatments patients ask about most, from injectables to resurfacing."
          items={treatments}
        />
        <FavSection
          heading="Common"
          accent="conditions"
          blurb="The skin and aesthetic concerns patients want to understand and treat."
          items={conditions}
        />
      </div>

      <Footer />
    </main>
  );
}
