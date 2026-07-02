import { Footer } from "@/components/footer";
import { CTACards } from "@/components/hero/cta-cards";
import { FindClinicSection } from "@/components/hero/find-clinic-section";
import { HeroSection } from "@/components/hero/hero-section";
import { HowItWorks } from "@/components/hero/how-it-works";
import { PopularTreatments } from "@/components/hero/popular-treatments";
import { ProvidersSpotlight } from "@/components/hero/providers-spotlight";
import { ResourcesSection } from "@/components/hero/resources-section";
import { Newsletter } from "@/components/hero/newsletter";
import { TopCities } from "@/components/hero/top-cities";
import { ArticleSection } from "@/components/hero/article-section";
import StatsSection from "@/components/hero/stat-section";
import { LocationHeadsUp } from "@/components/location/location-heads-up";
import { LocationPrompt } from "@/components/location/location-prompt";
import { getPopularTreatments } from "@/lib/treatments/popular";
import Image from "next/image";

export default async function Home() {
  const popularTreatments = await getPopularTreatments();

  return (
    <main className="relative flex flex-1 flex-col items-center bg-[#FDFDFD] gap-10 isolate w-full">     
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

      {/* Ask for location on landing; show a heads-up if outside the USA. */}
      <LocationPrompt />
      <LocationHeadsUp />

      <HeroSection />
      <StatsSection />
      <PopularTreatments treatments={popularTreatments} />
      <FindClinicSection />
      <ProvidersSpotlight />
      <HowItWorks />
      <ResourcesSection />
      <TopCities />
      <ArticleSection />
      <Newsletter />
      <Footer />
    </main>
  );
}
