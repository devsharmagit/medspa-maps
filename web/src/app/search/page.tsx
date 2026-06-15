import { Suspense } from "react";
import { SearchResults } from "./search-results";
import { HeroHeader } from "@/components/hero/hero-header";
import { Footer } from "@/components/footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search Results | MedSpa Maps",
  description:
    "Find the best medspas and aesthetic clinics near you. Compare ratings, services, and pricing.",
};

export default function SearchPage() {
  return (
    <main className="relative flex min-h-screen flex-col bg-[#FDFDFD]">
      {/* Hero header band */}
      <div className="bg-hero-gradient">
        <HeroHeader />
      </div>

      {/* Search results content */}
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center py-32">
            <div className="flex flex-col items-center gap-4">
              <div className="size-10 animate-spin rounded-full border-4 border-brand-magenta/20 border-t-brand-magenta" />
              <p className="text-sm text-brand-muted">Searching clinics…</p>
            </div>
          </div>
        }
      >
        <SearchResults />
      </Suspense>

      <Footer />
    </main>
  );
}
