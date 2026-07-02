import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ClinicsCarousel } from "@/components/shared/clinics-carousel";
import { ProvidersCarousel } from "@/components/shared/providers-carousel";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import {
  CalendarDays,
  Star,
  Clock,
  Sparkles,
  BadgeCheck,
  ChevronDown,
  ArrowLeft,
  ArrowRight
} from "lucide-react";
import { HeroHeader } from "@/components/hero/hero-header";
import { Footer } from "@/components/footer";
import { FaqAccordion } from "@/components/faq-accordion";
import { getTreatmentData } from "@/lib/treatments/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getTreatmentData(slug);
  if (!data) return { title: "Treatment not found" };
  return {
    title: `${data.service.name} — Medspa Map`,
    description: data.service.summary ?? data.service.description ?? undefined,
  };
}

export default async function TreatmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const latRaw = parseFloat(typeof sp.lat === "string" ? sp.lat : "");
  const lngRaw = parseFloat(typeof sp.lng === "string" ? sp.lng : "");
  const opts = {
    lat: Number.isNaN(latRaw) ? undefined : latRaw,
    lng: Number.isNaN(lngRaw) ? undefined : lngRaw,
  };

  const data = await getTreatmentData(slug, opts);
  if (!data) notFound();

  const { service, clinics, providers } = data;

  const hasStats =
    service.treatment_time != null ||
    service.results_timeline != null ||
    service.results_duration != null;

  return (
    <main 
      className="flex min-h-screen flex-col bg-[#faf7fb] text-zinc-950 font-sans"
      style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}
    >
      {/* Banner + nav */}
      <div className="bg-gradient-to-r from-[#7b2d6b] via-[#9b3a6e] to-[#b6663f]">
        <HeroHeader />
      </div>

      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-8 sm:px-6">
        {/* Breadcrumb */}
        <Breadcrumbs items={[
          { label: "Home", href: "/" },
          { label: "Treatments", href: "/treatments" },
          { label: service.name }
        ]} />

        {/* Hero card */}
        <section 
          className="relative mt-6 rounded-[18px] border border-[#DEDEDE] shadow-[0px_9px_11.1px_rgba(240,223,241,0.6)] px-12 py-10 text-white min-h-[400px] flex flex-col justify-center overflow-hidden"
          style={{
            background: `url('/images/treatment/treatment-bg-removed.png') right center / 50% auto no-repeat, linear-gradient(245.89deg, rgba(219, 120, 94, 0.8) 11.55%, rgba(196, 68, 207, 0.8) 113.3%), #FFFFFF`,
            backgroundBlendMode: 'multiply, normal, normal'
          }}
        >
          <div className="max-w-[700px] relative z-10">
            <h1 className="text-[48px] font-normal leading-[116%] tracking-[-0.04em] mb-6">
              {service.name}{" "}
              <span className="font-fraunces italic font-normal">Treatment</span>
            </h1>

            {service.hero_rating && (
              <div className="inline-flex items-center gap-3 rounded-full bg-black/20 px-4 py-2 backdrop-blur-sm mb-6">
                <span className="flex items-center gap-1.5 text-xs font-normal tracking-[-0.02em]">
                  {service.hero_rating}
                  <Star className="size-4 fill-[#FFBA19] text-[#FFBA19]" />
                  <span className="opacity-90">({service.hero_review_count})</span>
                </span>
              </div>
            )}

            {service.description && (
              <p className="text-[14px] leading-[150%] tracking-[0.02em] max-w-[547px] mb-8">
                {service.description}
              </p>
            )}

            {/* Stats bar */}
            {hasStats && (
              <div className="flex flex-row items-center justify-between rounded-[16px] bg-white px-8 py-4 shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] w-full max-w-[665px]">
                {service.treatment_time != null && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-[28px] w-[28px] items-center justify-center rounded bg-[#EE97C6]/20 relative">
                      <Clock className="size-4 text-[#EE97C6] absolute" />
                    </div>
                    <div>
                      <p className="text-[12px] font-medium uppercase tracking-[0.04em] text-[#CF5D9A]">
                        Treatment Time
                      </p>
                      <p className="text-[12px] font-medium tracking-[0.02em] text-[#616161] mt-0.5">
                        {service.treatment_time}
                      </p>
                    </div>
                  </div>
                )}
                
                {service.results_timeline != null && (
                  <>
                    <div className="h-[49px] border-l border-[#E5C7DA]/40"></div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-[28px] w-[28px] items-center justify-center rounded bg-[#EE97C6]/20 relative">
                        <Sparkles className="size-4 text-[#EE97C6] absolute" />
                      </div>
                      <div>
                        <p className="text-[12px] font-medium uppercase tracking-[0.04em] text-[#CF5D9A]">
                          Results
                        </p>
                        <p className="text-[12px] font-medium tracking-[0.02em] text-[#616161] mt-0.5">
                          {service.results_timeline}
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {service.results_duration != null && (
                  <>
                    <div className="h-[49px] border-l border-[#E5C7DA]/40"></div>
                    <div className="flex items-center gap-3">
                      <div className="flex h-[28px] w-[28px] items-center justify-center rounded bg-[#EE97C6]/20 relative">
                        <CalendarDays className="size-4 text-[#EE97C6] absolute" />
                      </div>
                      <div>
                        <p className="text-[12px] font-medium uppercase tracking-[0.04em] text-[#CF5D9A]">
                          Duration
                        </p>
                        <p className="text-[12px] font-medium tracking-[0.02em] text-[#616161] mt-0.5">
                          {service.results_duration}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </section>

        <ClinicsCarousel clinics={clinics} />

        <ProvidersCarousel providers={providers} />


        
        {/* FAQs */}
        <div className="mt-[100px] mb-20">
          <FaqAccordion faqs={service.faqs} entityName={service.name} />
        </div>
      </div>

      <Footer />
    </main>
  );
}
