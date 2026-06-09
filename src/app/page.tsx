import { CTACards } from "@/components/hero/cta-cards";
import { FindClinicSection } from "@/components/hero/find-clinic-section";
import { HeroSection } from "@/components/hero/hero-section";
import { HowItWorks } from "@/components/hero/how-it-works";
import { PopularTreatments } from "@/components/hero/popular-treatments";
import { ProvidersSpotlight } from "@/components/hero/providers-spotlight";
import { ResourcesSection } from "@/components/hero/resources-section";
import StatsSection from "@/components/hero/stat-section";
import { Testimonials } from "@/components/hero/testimonials";
import Image from "next/image";

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col items-center bg-[#FDFDFD] gap-10 ">
     
        {/* <div className="absolute inset-0" aria-hidden>
                  <div className="absolute inset-0 " />
                    <Image
                    src="/images/hero/whole-bg.png"
                    alt=""
                    fill
                    className="object-cover object-[70%_center] opacity-20 brightness-50 -z-10"
                    priority
                    sizes="100vw"
                  />
                 
                 
                </div> */}
     
      <HeroSection />
      <StatsSection />
      <PopularTreatments />
      <FindClinicSection />
      <ProvidersSpotlight />
      <HowItWorks />
      <Testimonials />
      <CTACards />
      <ResourcesSection />
    </main>
  );
}
