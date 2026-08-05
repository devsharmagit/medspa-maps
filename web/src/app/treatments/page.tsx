import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { ListingHero } from "@/components/shared/listing-hero";
import { listTreatments } from "@/lib/treatments/queries";
import { TreatmentsGrid } from "./treatments-grid";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Treatments — Med Spa Maps",
  description:
    "Browse all med spa treatments — Botox, dermal fillers, laser, microneedling and more. Find practices offering each treatment near you.",
};

export default async function TreatmentsIndexPage() {
  const treatments = await listTreatments();

  return (
    <main
      className="flex min-h-screen flex-col bg-[#faf7fb] text-zinc-950 relative overflow-x-hidden"
      style={{ fontFamily: "var(--font-montserrat), sans-serif" }}
    >
      <ListingHero
        crumbs={[{ label: "Home", href: "/" }, { label: "Treatments" }]}
        title="Aesthetic"
        accent="Treatments"
        subtitle="From injectables and lasers to body contouring — explore every treatment on Med Spa Maps, then discover the top-rated practices offering it near you."
      />

      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-20 sm:px-6">
        <TreatmentsGrid treatments={treatments} />
      </div>

      <Footer />
    </main>
  );
}
