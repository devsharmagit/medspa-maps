import { notFound } from "next/navigation";
import Link from "next/link";
import React from "react";
import type { Metadata } from "next";
import {
  ChevronRight,
  Calendar,
  Phone,
  MapPin,
  Star,
  Sparkles,
  Award,
  BadgeCheck,
  GraduationCap,
  Smile,
  Heart,
  Syringe,
  Zap,
  Grid,
  Layers,
  HeartPulse,
  Activity,
} from "lucide-react";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { TreatmentsCarousel } from "@/components/shared/treatments-carousel";
import { OtherProvidersCarousel } from "@/components/shared/other-providers-carousel";
import { HeroHeader } from "@/components/hero/hero-header";
import { Footer } from "@/components/footer";
import { query, queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

interface ProviderDetails {
  id: string;
  clinic_id: string;
  name: string;
  title: string | null;
  bio: string | null;
  card_tagline: string | null;
  review_rating: string | null;
  review_count: number | null;
  image_url: string | null;
  years_experience: number | null;
  is_verified: boolean;
  highlights: string[] | null;
  credentials: { title: string; institution: string }[] | null;
  specialties: { title: string; description: string }[] | null;
  is_active: boolean;
  
  clinic_name: string;
  clinic_slug: string;
  clinic_city: string | null;
  clinic_state: string | null;
  clinic_logo_url: string | null;
  clinic_booking_url: string | null;
  clinic_phone: string | null;
  clinic_address: string | null;
  clinic_zip: string | null;
}

interface ClinicService {
  id: string;
  name: string;
  description: string | null;
}

interface OtherProvider {
  id: string;
  name: string;
  title: string | null;
  image_url: string | null;
  is_verified: boolean;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const provider = await queryOne<{ name: string; title: string | null }>(
    `SELECT p.name, p.title
       FROM providers p
       JOIN clinics c ON c.id = p.clinic_id
      WHERE p.id = $1 AND p.is_active = true AND c.is_active = true`,
    [id]
  );
  if (!provider) return { title: "Provider not found" };
  return {
    title: `${provider.name} — ${provider.title ?? "Aesthetic Specialist"}`,
    description: `Book an appointment with ${provider.name}, specializing in facial aesthetics and cosmetic treatments.`,
  };
}

const MOCK_BEFORE_AFTER = [
  {
    title: "Skin Rejuvenation",
    before: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=600&auto=format&fit=crop&q=80",
    after: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&auto=format&fit=crop&q=80",
  },
  {
    title: "Lip Fillers",
    before: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=600&auto=format&fit=crop&q=80",
    after: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=600&auto=format&fit=crop&q=80",
  },
  {
    title: "Skin Rejuvenation",
    before: "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=600&auto=format&fit=crop&q=80",
    after: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&auto=format&fit=crop&q=80",
  },
  {
    title: "Lip Fillers",
    before: "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=600&auto=format&fit=crop&q=80",
    after: "https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=600&auto=format&fit=crop&q=80",
  }
];

function getHighlightIcon(text: string) {
  const t = text.toLowerCase();
  if (t.includes("cert") || t.includes("board") || t.includes("deg") || t.includes("grad") || t.includes("licensed")) return GraduationCap;
  if (t.includes("expert") || t.includes("facial") || t.includes("aesthet") || t.includes("skin")) return Smile;
  if (t.includes("natur") || t.includes("result") || t.includes("look")) return Sparkles;
  if (t.includes("patient") || t.includes("care") || t.includes("client") || t.includes("boutique")) return Heart;
  return Award;
}

function getSpecialtyIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes("inject") || t.includes("botox") || t.includes("filler")) return Syringe;
  if (t.includes("rejuven") || t.includes("face") || t.includes("facial")) return Smile;
  if (t.includes("skin") || t.includes("health") || t.includes("peel") || t.includes("laser")) return Sparkles;
  if (t.includes("prevent") || t.includes("aging") || t.includes("grace")) return Sparkles;
  return Activity;
}

function getServiceIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("syringe") || n.includes("filler") || n.includes("inject")) return Syringe;
  if (n.includes("botox") || n.includes("toxin") || n.includes("dysport") || n.includes("xeomin")) return Sparkles;
  if (n.includes("laser") || n.includes("ipl") || n.includes("bbl")) return Zap;
  if (n.includes("peel") || n.includes("facial") || n.includes("exfoli")) return Smile;
  if (n.includes("needl") || n.includes("micro")) return Grid;
  if (n.includes("resurfac") || n.includes("layer")) return Layers;
  if (n.includes("iv") || n.includes("therap") || n.includes("drip")) return HeartPulse;
  if (n.includes("body") || n.includes("sculpt") || n.includes("contour") || n.includes("coolsculpt")) return Activity;
  return Sparkles;
}

function renderClinicLogo(name: string, logoUrl: string | null) {
  if (logoUrl) {
    return (
      <div className="size-20 rounded-2xl border border-pink-100 bg-white p-2.5 flex items-center justify-center shadow-sm shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={`${name} logo`} className="size-full object-contain" />
      </div>
    );
  }
  
  // Custom styled fallback logo to look exactly like screenshot
  const cleanName = name.replace(/medspa|medical|clinic|lounge|lab|\+|&/gi, "").trim();
  const words = cleanName.split(/\s+/);
  const firstWord = words[0] || "RUMA";
  const secondWord = words.slice(1).join(" ") || "MEDICAL";
  
  return (
    <div className="size-20 rounded-2xl border border-pink-100 bg-[#fdfafc] p-3 flex flex-col items-center justify-center text-center shadow-sm shrink-0">
      <span className="text-[11px] font-bold tracking-[0.15em] text-[#cf5b9d] leading-none uppercase">{firstWord}</span>
      {secondWord && (
        <span className="text-[7px] font-medium tracking-[0.25em] text-slate-400 mt-1.5 leading-none uppercase truncate max-w-full">{secondWord}</span>
      )}
    </div>
  );
}

export default async function ProviderPage({
  params,
}: {
  params: Promise<{ id: string; slug: string }>;
}) {
  const { id } = await params;

  // Retrieve provider and clinic details
  const provider = await queryOne<ProviderDetails>(
    `SELECT p.*, c.name AS clinic_name, c.slug AS clinic_slug, c.city AS clinic_city,
            c.booking_url AS clinic_booking_url, c.phone AS clinic_phone,
            c.state AS clinic_state, c.address AS clinic_address, c.zip AS clinic_zip,
            COALESCE(
              (SELECT source_url FROM images i
                 WHERE i.entity_type = 'clinic' AND i.entity_id = c.id
                   AND i.role = 'logo' AND i.scrape_status = 'ok'
                 ORDER BY i.sort_order LIMIT 1),
              (SELECT source_url FROM images i
                 WHERE i.entity_type = 'business' AND i.entity_id = c.business_id
                   AND i.role = 'logo' AND i.scrape_status = 'ok'
                 ORDER BY i.sort_order LIMIT 1)
            ) AS clinic_logo_url
       FROM providers p
       JOIN clinics c ON p.clinic_id = c.id
      WHERE p.id = $1 AND p.is_active = true AND c.is_active = true`,
    [id]
  );

  if (!provider) notFound();

  // Retrieve canonical treatments offered by the provider
  const services = await query<{id: string, name: string, description: string, clinic_count: number}>(
    `SELECT s.id, s.name, s.summary AS description,
            (SELECT COUNT(DISTINCT clinic_id) FROM clinic_services WHERE service_id = s.id AND is_active = TRUE) AS clinic_count
       FROM provider_services ps
       JOIN services s ON ps.service_id = s.id
      WHERE ps.provider_id = $1 AND s.is_active = TRUE
      ORDER BY s.name ASC`,
    [id]
  );

  // Retrieve other providers from the same clinic
  const otherProviders = await query<OtherProvider>(
    `SELECT id, name, title, image_url, is_verified
       FROM providers
      WHERE clinic_id = $1 AND id != $2 AND is_active = TRUE
      LIMIT 4`,
    [provider.clinic_id, id]
  );

  const loc = [provider.clinic_city, provider.clinic_state].filter(Boolean).join(", ");
  const reviewRating = provider.review_rating != null ? Number(provider.review_rating) : null;
  const reviewCount = provider.review_count ?? 0;
  const bookUrl = provider.clinic_booking_url || "#";
  const defaultPhoto = "https://images.stockcake.com/public/1/9/d/19d13828-c999-4e2d-a191-9da4dd8bd824_large/confident-medical-professional-stockcake.jpg";

  return (
    <main className="flex min-h-screen flex-col bg-[#faf7fb] text-zinc-950 font-sans overflow-x-clip">
      {/* Banner + Nav Header */}
      <div className="bg-gradient-to-r from-[#7b2d6b] via-[#9b3a6e] to-[#b6663f]">
        <HeroHeader />
      </div>

      <div className="mx-auto w-full max-w-[1440px] px-[16px] sm:px-[34px] pt-[35px] pb-[60px] flex flex-col gap-[35px]">
        
        {/* Breadcrumb Navigation */}
        <div className="-mb-6">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Clinics", href: "/clinics" },
              { label: provider.clinic_name, href: `/clinics/${provider.clinic_slug}` },
              { label: provider.name }
            ]}
          />
        </div>

        {/* ── Main Profile Card ── */}
        <section className="bg-white rounded-[18px] shadow-[0px_9px_11.1px_rgba(240,223,241,0.6)] py-8 px-5 sm:py-[40px] sm:px-[62px]">
          <div className="flex flex-col xl:flex-row gap-8 sm:gap-[40px] items-start">
            
            {/* Left Side: Avatar and Quick Stats */}
            <div className="flex flex-col bg-white rounded-[22px] shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] shrink-0 w-full xl:w-[358px]">
              <div className="relative h-[260px] sm:h-[317px] w-full bg-[#E4DBD9] rounded-t-[22px] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={provider.image_url || defaultPhoto}
                  alt={provider.name}
                  className="h-full w-full object-cover object-top"
                />
              </div>
              <div className="h-[88px] w-full bg-white rounded-b-[22px] flex flex-row items-center justify-between px-[24px]">
                <div className="flex flex-col items-center gap-[4px]">
                  <div className="flex gap-[4px]">
                    {Array.from({ length: 5 }).map((_, s) => {
                      const filled = reviewRating == null ? true : s < Math.round(reviewRating);
                      return (
                        <Star
                          key={s}
                          className={`size-[18px] ${filled ? "fill-[#FFBA19] text-[#FFBA19]" : "fill-[#E5C7DA]/40 text-[#E5C7DA]/40"}`}
                        />
                      );
                    })}
                  </div>
                  <span className="text-[12px] font-medium text-[#616161] tracking-[0.02em] leading-[130%]">
                    {reviewRating != null ? reviewRating.toFixed(1) : "New"} ({reviewCount} {reviewCount === 1 ? "Review" : "Reviews"})
                  </span>
                </div>
                <div className="w-px h-[35px] bg-[#E5C7DA]/40" />
                <div className="flex flex-col items-center gap-[2px]">
                  <span className="text-[12px] font-medium text-[#CF5B9D] tracking-[0.02em] leading-[130%]">
                    {provider.years_experience ?? 10}+
                  </span>
                  <span className="text-[12px] font-medium text-[#616161] tracking-[0.02em] leading-[130%]">Years Experience</span>
                </div>
              </div>
            </div>

            {/* Right Side: Profile Details */}
            <div className="flex-1 flex flex-col gap-[34px] w-full">
              
              {/* Header Details with Logo */}
              <div className="flex items-start justify-between gap-3 sm:gap-[24px]">
                <div className="flex flex-col gap-[8px] min-w-0">
                  <h1 className="text-[26px] sm:text-[36px] font-medium text-[#373634] tracking-[-0.04em] leading-[116%] flex items-center gap-[10px]">
                    {provider.name}
                    {provider.is_verified && (
                      <BadgeCheck className="size-[22px] sm:size-[28px] shrink-0 fill-[#CF5D9A] text-white" />
                    )}
                  </h1>
                  <span className="text-[16px] font-medium text-[#CF5B9D] tracking-[0.02em] leading-[150%]">
                    {provider.title || "Aesthetic Specialist"}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-[16px]">
                    <span className="text-[16px] font-medium text-[#575757] tracking-[0.02em] leading-[150%]">
                      {provider.clinic_name}
                    </span>
                    {loc && (
                      <>
                        <div className="w-px h-[24px] bg-[#E5C7DA]/40" />
                        <span className="text-[16px] font-medium text-[#575757] tracking-[0.02em] leading-[150%]">
                          {loc}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                
                {provider.clinic_logo_url ? (
                  <div className="w-[88px] h-[76px] sm:w-[122px] sm:h-[106px] shrink-0 border border-[#E5C7DA] bg-white rounded-[16px] p-2 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={provider.clinic_logo_url} alt={provider.clinic_name} className="max-h-full max-w-full object-contain" />
                  </div>
                ) : (
                  <div className="w-[88px] h-[76px] sm:w-[122px] sm:h-[106px] shrink-0 border border-[#E5C7DA] bg-white rounded-[16px] flex flex-col items-center justify-center p-3 text-center">
                    <span className="text-[14px] font-bold text-[#cf5b9d] uppercase leading-none">{provider.clinic_name.split(/\s+/)[0]}</span>
                    <span className="text-[9px] font-medium text-slate-400 mt-1 uppercase leading-none">{provider.clinic_name.split(/\s+/).slice(1).join(" ")}</span>
                  </div>
                )}
              </div>

              {/* Bio Statement */}
              <p className="text-[16px] font-normal text-[#575757] tracking-[0.02em] leading-[150%]">
                {provider.bio || `Welcome to the profile of ${provider.name} at ${provider.clinic_name}.`}
              </p>

              {/* Highlights strip (rounded pill/box container) */}
              {provider.highlights && provider.highlights.length > 0 && (
                <div className="bg-white rounded-[16px] shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)] h-auto py-[16px] px-[20px] sm:h-[81px] sm:py-0 sm:px-[40px] flex flex-wrap sm:flex-nowrap items-center justify-between gap-[24px]">
                  {provider.highlights.slice(0, 4).map((h, i) => {
                    const HighlightIcon = getHighlightIcon(h);
                    return (
                      <React.Fragment key={i}>
                        <div className="flex items-center gap-[8px] max-w-[149px]">
                          <HighlightIcon className="size-[24px] text-[#EE97C6] shrink-0" />
                          <span className="text-[12px] font-medium text-[#616161] tracking-[0.02em] leading-[130%]">
                            {h}
                          </span>
                        </div>
                        {i < Math.min(provider.highlights!.length, 4) - 1 && (
                          <div className="hidden sm:block w-px h-[49px] bg-[#E5C7DA]/40" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-[16px]">
                <a
                  href={bookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex flex-1 sm:flex-none items-center justify-center gap-[10px] rounded-[8px] bg-gradient-to-r from-[#DE7F4C] to-[#C341D7] px-[24px] py-[10px] h-[48px] text-[14px] font-semibold text-white transition hover:opacity-95"
                >
                  Book Appointment <Calendar className="size-[20px]" />
                </a>
                {provider.clinic_phone && (
                  <a
                    href={`tel:${provider.clinic_phone}`}
                    className="inline-flex flex-1 sm:flex-none items-center justify-center gap-[10px] rounded-[8px] border-[1.5px] border-[#D96F8E] bg-white px-[24px] py-[10px] h-[48px] text-[14px] font-semibold text-[#CF5B9D] transition hover:bg-pink-50/50"
                  >
                    Call Clinic <Phone className="size-[17px]" />
                  </a>
                )}
              </div>

            </div>
          </div>
        </section>

        {/* ── Credentials and Specialties Card ── */}
        <section className="rounded-[18px] border border-[#DEDEDE] bg-white py-8 px-5 sm:py-[40px] sm:px-[40px] shadow-[0px_9px_11.1px_rgba(240,223,241,0.6)] flex flex-col gap-[36px]">

          <div className="grid md:grid-cols-[1fr_1.5fr] gap-x-[36px] gap-y-10 relative">

            {/* Credentials Column */}
            <div className="flex flex-col gap-[24px] md:pr-[36px]">
              <h2 className="text-[26px] sm:text-[34px] font-normal text-[#373634] leading-[116%] tracking-[-0.04em]">
                Credentials & Education
              </h2>
              {provider.credentials && provider.credentials.length > 0 ? (
                <div className="flex flex-col gap-[24px]">
                  {provider.credentials.map((cred, idx) => (
                    <div key={idx} className="flex flex-row items-center gap-4 sm:gap-[32px]">
                      <div className="size-[42px] rounded-full border-[1.6px] border-[#EE97C6] flex items-center justify-center shrink-0">
                        <Award className="size-[24px] text-[#EE97C6] stroke-[1.5]" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-[16px] text-[#575757] leading-[150%] tracking-[0.02em]">{cred.title}</span>
                        <span className="text-[14px] font-normal text-[#575757] leading-[150%] tracking-[0.02em]">{cred.institution}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[14px] text-[#727272]">Credentials details have not been updated yet.</p>
              )}
            </div>
            
            {/* Vertical Divider */}
            <div className="hidden md:block absolute left-[40%] top-0 bottom-0 w-px bg-[#E5C7DA]/40"></div>

            {/* Specialties Column */}
            <div className="flex flex-col gap-[24px]">
              <h2 className="text-[26px] sm:text-[34px] font-normal text-[#373634] leading-[116%] tracking-[-0.04em]">
                Specialties
              </h2>
              {provider.specialties && provider.specialties.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-[24px]">
                  {provider.specialties.map((spec, idx) => {
                    const SpecIcon = getSpecialtyIcon(spec.title);
                    return (
                      <div
                        key={idx}
                        className="p-5 sm:py-[24px] sm:px-[36px] rounded-[16px] bg-white flex flex-row items-center gap-4 sm:gap-[24px] shadow-[0px_6px_10.5px_1px_rgba(0,0,0,0.05)]"
                      >
                        <div className="shrink-0 flex items-center justify-center text-[#EE97C6]">
                          <SpecIcon className="size-10 sm:size-[50px] stroke-[1]" />
                        </div>
                        <div className="flex flex-col gap-[8px] justify-center">
                          <span className="font-semibold text-[18px] text-[#575757] leading-[150%] tracking-[0.02em]">{spec.title}</span>
                          <p className="text-[14px] font-normal text-[#575757] leading-[150%] tracking-[0.02em] line-clamp-3">{spec.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[14px] text-[#727272]">Specialty details have not been updated yet.</p>
              )}
            </div>

          </div>
        </section>

        {/* ── Treatment Offered By Provider ── */}
        <TreatmentsCarousel providerName={provider.name} services={services} />

        {/* ── Other Clinic Providers ── */}
        <OtherProvidersCarousel 
          clinicName={provider.clinic_name}
          providers={otherProviders}
          bookUrl={bookUrl}
          clinicPhone={provider.clinic_phone}
        />

      </div>

      <Footer />
    </main>
  );
}
