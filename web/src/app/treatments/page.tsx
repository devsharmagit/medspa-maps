import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { HeroHeader } from "@/components/hero/hero-header";
import { Footer } from "@/components/footer";
import { listTreatments } from "@/lib/treatments/queries";
import { TreatmentsGrid } from "./treatments-grid";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Treatments — Medspa Map",
  description:
    "Browse all medspa treatments — Botox, dermal fillers, laser, microneedling and more. Find clinics offering each treatment near you.",
};

export default async function TreatmentsIndexPage() {
  const treatments = await listTreatments();

  return (
    <main className="flex min-h-screen flex-col bg-[#faf7fb] text-zinc-950">
      {/* Banner + nav */}
      <div className="bg-gradient-to-r from-[#7b2d6b] via-[#9b3a6e] to-[#b6663f]">
        <HeroHeader />
        <div className="mx-auto w-full max-w-[1200px] px-4 pb-12 pt-4 sm:px-6">
          <nav className="flex items-center gap-1.5 text-sm text-white/70">
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="text-white">Treatments</span>
          </nav>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Explore Treatments
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-white/80">
            Browse every treatment available on Medspa Map. Select one to see what
            it involves and the clinics offering it near you.
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 sm:px-6">
        <TreatmentsGrid treatments={treatments} />
      </div>

      <Footer />
    </main>
  );
}
