import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/footer";
import { ListingHero } from "@/components/shared/listing-hero";
import { CONCERN_CATALOG } from "@/lib/concerns/catalog";
import { CORE_CONCERNS } from "@/lib/taxonomy/core-catalog";
import { coreConcernFor } from "@/lib/taxonomy/core-catalog";
import { conditionImage } from "@/lib/images/catalog-images";

export const metadata: Metadata = {
  title: "Skin & Body Conditions — Medspa Maps",
  description:
    "Explore treatment guides and expert information for various skin and body conditions.",
};

/**
 * The 14 core concerns, each with editorial copy where CONCERN_CATALOG still has
 * some for the slug it absorbed.
 *
 * Before the 2026-09-06 reduction this page rendered CONCERN_CATALOG directly —
 * 10 hand-written entries. Two of those slugs (stretch-marks, stubborn-body-fat)
 * were retired with no core replacement, so their cards would now link to a
 * search that returns nothing. Driving the list from CORE_CONCERNS instead means
 * this page can only ever offer concerns that actually exist.
 *
 * The copy lookup is by redirect: `fine-lines-wrinkles` prose is reused for
 * `wrinkles`, `hyperpigmentation` for `pigmentation`, and so on. Core concerns
 * with no inherited copy fall back to a short generic line rather than an empty
 * card.
 */
const CONDITION_CARDS = CORE_CONCERNS.map((core) => {
  const legacy = CONCERN_CATALOG.find(
    (c) => c.slug === core.slug || coreConcernFor(c.slug) === core.slug,
  );
  return {
    slug: core.slug,
    name: core.name,
    overview:
      legacy?.overview ??
      `Find med spas near you that treat ${core.name.toLowerCase()}, with verified treatment menus and real patient reviews.`,
  };
});

export default function ConditionsIndexPage() {
  return (
    <main
      className="flex min-h-screen flex-col bg-[#faf7fb] text-zinc-950 relative overflow-x-hidden"
      style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
    >
      <ListingHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Conditions" }]}
        title="Skin & Body"
        accent="Conditions"
        subtitle="Understand what's behind your concern and the proven treatments that address it — then find vetted practices ready to help."
      />

      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-20 sm:px-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {CONDITION_CARDS.map((concern, index) => (
            <Link
              key={concern.slug}
              href={`/search?condition=${concern.slug}`}
              className="group flex flex-col overflow-hidden rounded-[18px] border border-[#F0E2EC] bg-white shadow-[0px_6px_14px_rgba(170,78,179,0.06)] transition-all duration-300 hover:-translate-y-1 hover:border-[#E3CED8] hover:shadow-[0px_16px_34px_rgba(170,78,179,0.14)]"
            >
              <div className="relative h-[200px] w-full overflow-hidden bg-[linear-gradient(144.23deg,#F5F0F7_-33.1%,#FFFFFF_48.72%)]">
                <Image
                  src={conditionImage(concern.slug)}
                  alt={concern.name}
                  fill
                  priority={index < 4}
                  className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
                <h2 className="absolute inset-x-4 bottom-3 text-[18px] font-semibold leading-tight tracking-[-0.01em] text-white drop-shadow-sm">
                  {concern.name}
                </h2>
              </div>
              <div className="flex flex-1 flex-col px-6 py-5">
                <p className="mb-5 line-clamp-3 flex-1 text-[13.5px] leading-[1.6] text-[#6b6a68]">
                  {concern.overview}
                </p>
                <div className="mt-auto inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#CF5B9D]">
                  Find Practices
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <Footer />
    </main>
  );
}
