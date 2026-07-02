import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight, CalendarDays, Star } from "lucide-react";
import { HeroHeader } from "@/components/hero/hero-header";
import { Footer } from "@/components/footer";
import { FaqAccordion } from "@/components/faq-accordion";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { getConcernData } from "@/lib/concerns/queries";
import { ConcernTabs } from "./concern-tabs";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getConcernData(slug);
  if (!data) return { title: "Concern not found" };
  return {
    title: data.concern.meta_title ?? `${data.concern.name} — Medspa Map`,
    description:
      data.concern.meta_description ?? data.concern.overview ?? undefined,
  };
}

export default async function ConditionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getConcernData(slug);
  if (!data) notFound();

  const { concern } = data;

  return (
    <main 
      className="flex min-h-screen flex-col bg-[#faf7fb] text-zinc-950 font-sans relative overflow-x-hidden"
      style={{ fontFamily: 'var(--font-montserrat), sans-serif' }}
    >
      {/* Banner + nav */}
      <div className="bg-gradient-to-r from-[#7b2d6b] via-[#9b3a6e] to-[#b6663f]">
        <HeroHeader />
      </div>

      <div className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-12 sm:px-6">
        <Breadcrumbs items={[
          { label: "Home", href: "/" },
          { label: "Concerns", href: "/conditions" },
          { label: concern.name }
        ]} />

        {/* Title row */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[48px] font-normal leading-[116%] tracking-[-0.04em] text-[#373634]">
            {concern.name}
          </h1>
          <a
            href="#clinics"
            className="inline-flex items-center gap-2 rounded-[8px] bg-gradient-to-r from-[#DE7F4C] to-[#C341D7] px-6 py-[12px] text-[14px] font-semibold text-white shadow-sm transition hover:opacity-95"
          >
            Book Appointment <CalendarDays className="size-[20px]" />
          </a>
        </div>

        {/* Tabs + overview + clinics */}
        <div className="mt-10">
          <ConcernTabs data={data} />
        </div>

        {/* Before & After — hidden for now */}

        {/* FAQs */}
        <div className="mt-12 mb-20">
          <FaqAccordion faqs={concern.faqs} entityName={concern.name} />
        </div>
      </div>

      <Footer />
    </main>
  );
}
