import { Footer } from "@/components/footer";
import { CTACards } from "@/components/hero/cta-cards";
import { FindClinicSection } from "@/components/hero/find-clinic-section";
import { HeroSection } from "@/components/hero/hero-section";
import { HowItWorks } from "@/components/hero/how-it-works";
import { PopularTreatments } from "@/components/hero/popular-treatments";
import { ProvidersSpotlight } from "@/components/hero/providers-spotlight";
import { TopCities } from "@/components/hero/top-cities";
import { ArticleSection } from "@/components/hero/article-section";
import StatsSection from "@/components/hero/stat-section";
import { getFeaturedClinics } from "@/lib/clinics/featured";
import { getPopularTreatments } from "@/lib/treatments/popular";
import { getAllProviders } from "@/lib/providers/queries";
import Image from "next/image";

// Queries the database, so it can't be prerendered at Docker build time —
// env (DATABASE_URL etc.) is only injected at runtime via ECS Secrets Manager.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [popularTreatments, featuredClinics, spotlightProviders] = await Promise.all([
    getPopularTreatments(),
    getFeaturedClinics(5),
    getAllProviders(5, { requireImage: true }),
  ]);

  return (
    <main className="relative flex flex-1 flex-col items-center bg-[#FDFDFD] gap-10 isolate w-full overflow-x-clip">
      {/* Page-wide Background Image */}
      <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden" aria-hidden="true">
        <Image
          src="/images/landingpage/whole-bg-png.png"
          alt=""
          fill
          className="object-cover object-center opacity-20"
          priority
          sizes="100vw"
        />
      </div>

      <HeroSection />
      <StatsSection />
      <PopularTreatments treatments={popularTreatments} />
      <FindClinicSection clinics={featuredClinics} />
      <ProvidersSpotlight providers={spotlightProviders} />
      <HowItWorks />
      <TopCities />
      <ArticleSection />
      <Footer />
    </main>
  );
}
