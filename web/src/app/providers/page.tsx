import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { ListingHero } from "@/components/shared/listing-hero";
import { ProvidersCarousel } from "@/components/shared/providers-carousel";
import { getAllProviders } from "@/lib/providers/queries";

export const metadata: Metadata = {
  title: "Expert Providers — Medspa Map",
  description:
    "Discover verified and expert medical spa providers tailored to your needs.",
};

export const dynamic = "force-dynamic";

export default async function ProvidersIndexPage() {
  const providers = await getAllProviders();

  return (
    <main
      className="flex min-h-screen flex-col bg-[#faf7fb] text-zinc-950 relative overflow-x-hidden"
      style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
    >
      <ListingHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Providers" }]}
        title="Meet Our"
        accent="Experts"
        subtitle="Highly rated, verified medical professionals and aesthetic specialists — dedicated to delivering safe, natural-looking results."
      />

      {/* Zero the carousel's built-in top margin so it sits under the title block. */}
      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-20 sm:px-6 [&_section]:!mt-0">
        <ProvidersCarousel providers={providers} />
      </div>

      <Footer />
    </main>
  );
}
