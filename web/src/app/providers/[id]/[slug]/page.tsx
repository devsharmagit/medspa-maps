import { notFound } from "next/navigation";
import Link from "next/link";
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
    "SELECT name, title FROM providers WHERE id = $1",
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
      WHERE p.id = $1`,
    [id]
  );

  if (!provider) notFound();

  // Retrieve canonical treatments offered by the provider
  const services = await query<ClinicService>(
    `SELECT s.id, s.name, s.summary AS description
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
  const bookUrl = provider.clinic_booking_url || "#";
  const defaultPhoto = "https://images.stockcake.com/public/1/9/d/19d13828-c999-4e2d-a191-9da4dd8bd824_large/confident-medical-professional-stockcake.jpg";

  return (
    <main className="flex min-h-screen flex-col bg-[#faf7fb] text-zinc-950 font-sans">
      {/* Banner + Nav Header */}
      <div className="bg-gradient-to-r from-[#7b2d6b] via-[#9b3a6e] to-[#b6663f]">
        <HeroHeader />
      </div>

      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 flex flex-col gap-8">
        
        {/* Breadcrumb Navigation */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-zinc-500">
          <Link href="/" className="hover:text-zinc-800 transition-colors">
            Home
          </Link>
          <ChevronRight className="size-3.5 text-zinc-300" />
          <Link href="/clinics" className="hover:text-zinc-800 transition-colors">
            Clinics
          </Link>
          <ChevronRight className="size-3.5 text-zinc-300" />
          <Link href={`/clinics/${provider.clinic_slug}`} className="hover:text-zinc-800 transition-colors">
            {provider.clinic_name}{loc ? `, ${loc}` : ""}
          </Link>
          <ChevronRight className="size-3.5 text-zinc-300" />
          <span className="text-zinc-700 font-medium">
            {provider.name}
          </span>
        </nav>

        {/* ── Main Profile Card ── */}
        <section className="overflow-hidden rounded-[32px] border border-pink-100/60 bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgb(253,244,251,0.5)]">
          <div className="flex flex-col md:flex-row gap-8 relative">
            
            {/* Left Side: Avatar and Quick Stats */}
            <div className="w-full md:w-[300px] shrink-0 flex flex-col gap-4">
              <div className="relative aspect-[4/5] w-full rounded-3xl overflow-hidden bg-slate-50 border border-slate-100 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={provider.image_url || defaultPhoto}
                  alt={provider.name}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Review count & experience strip */}
              <div className="flex items-center justify-between border-t border-zinc-100 pt-4 px-2">
                <div className="flex flex-col items-center gap-1">
                  <div className="flex gap-0.5 text-amber-400">
                    {Array.from({ length: 5 }).map((_, s) => (
                      <Star key={s} className="size-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-slate-700">5.0 (89 Reviews)</span>
                </div>
                <div className="h-8 w-px bg-zinc-200" />
                <div className="flex flex-col items-center">
                  <span className="text-lg font-bold text-[#b6663f] leading-none">
                    {provider.years_experience ?? 10}+
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium mt-1">Years Experience</span>
                </div>
              </div>
            </div>

            {/* Right Side: Profile Details */}
            <div className="flex-1 flex flex-col justify-between">
              
              {/* Header Details with Logo */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-2">
                  <h1 className="text-3xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
                    {provider.name}
                    {provider.is_verified && (
                      <BadgeCheck className="size-7 text-[#cf5b9d] fill-pink-50" />
                    )}
                  </h1>
                  <span className="text-sm font-semibold uppercase tracking-wider text-[#cf5b9d]">
                    {provider.title || "Aesthetic Specialist"}
                  </span>
                  <span className="text-sm font-medium text-slate-500 flex items-center gap-1">
                    <Link href={`/clinics/${provider.clinic_slug}`} className="hover:text-[#cf5b9d] transition-colors">
                      {provider.clinic_name}
                    </Link>
                    {loc && ` · ${loc}`}
                  </span>
                </div>
                {renderClinicLogo(provider.clinic_name, provider.clinic_logo_url)}
              </div>

              {/* Bio Statement */}
              <p className="mt-5 text-sm leading-relaxed text-slate-600 max-w-2xl">
                {provider.bio || `Welcome to the profile of ${provider.name} at ${provider.clinic_name}.`}
              </p>

              {/* Highlights strip (rounded pill/box container) */}
              {provider.highlights && provider.highlights.length > 0 && (
                <div className="mt-6 border border-pink-100/60 bg-[#fdfafc] rounded-2xl p-4.5 grid grid-cols-2 lg:grid-cols-4 gap-4 shadow-sm">
                  {provider.highlights.slice(0, 4).map((h, i) => {
                    const HighlightIcon = getHighlightIcon(h);
                    return (
                      <div key={i} className="flex items-center gap-2 text-left">
                        <div className="size-8 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0 border border-pink-50">
                          <HighlightIcon className="size-4.5 text-[#cf5b9d]" />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-700 leading-tight">
                          {h}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href={bookUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#e08a4f] to-[#cf5b9d] px-6 py-3.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
                >
                  <Calendar className="size-4" /> Book Appointment
                </a>
                {provider.clinic_phone && (
                  <a
                    href={`tel:${provider.clinic_phone}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d96f8e] px-6 py-3.5 text-sm font-semibold text-[#9b3a6e] transition hover:bg-pink-50/50"
                  >
                    <Phone className="size-4" /> Call Clinic
                  </a>
                )}
              </div>

            </div>
          </div>
        </section>

        {/* ── Credentials and Specialties Card ── */}
        <section className="rounded-[32px] border border-pink-100/60 bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgb(253,244,251,0.5)] grid md:grid-cols-2 gap-8">
          
          {/* Credentials Column */}
          <div className="flex flex-col gap-6">
            <h2 className="text-xl font-bold text-slate-900 border-b border-pink-50 pb-4">
              Credentials & Education
            </h2>
            {provider.credentials && provider.credentials.length > 0 ? (
              <div className="flex flex-col gap-5">
                {provider.credentials.map((cred, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="size-9 rounded-full bg-pink-50 border border-pink-100 flex items-center justify-center text-[#cf5b9d] shrink-0">
                      <GraduationCap className="size-5" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-sm text-slate-800">{cred.title}</span>
                      <span className="text-xs text-slate-400">{cred.institution}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Credentials details have not been updated yet.</p>
            )}
          </div>

          {/* Specialties Column */}
          <div className="flex flex-col gap-6">
            <h2 className="text-xl font-bold text-slate-900 border-b border-pink-50 pb-4">
              Specialties
            </h2>
            {provider.specialties && provider.specialties.length > 0 ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {provider.specialties.map((spec, idx) => {
                  const SpecIcon = getSpecialtyIcon(spec.title);
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl border border-pink-100/30 bg-pink-50/15 flex flex-col gap-2 shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-lg bg-white border border-pink-50 shadow-sm flex items-center justify-center text-[#cf5b9d] shrink-0">
                          <SpecIcon className="size-4.5" />
                        </div>
                        <span className="font-semibold text-sm text-slate-800">{spec.title}</span>
                      </div>
                      <p className="text-xs text-slate-500 leading-normal">{spec.description}</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400">Specialty details have not been updated yet.</p>
            )}
          </div>

        </section>

        {/* ── Treatment Offered By Provider ── */}
        {services.length > 0 && (
          <section className="flex flex-col gap-6">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Treatment <span className="font-fraunces italic font-normal">Offered</span> By {provider.name}
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none snap-x snap-mandatory">
              {services.map((svc) => {
                const SvcIcon = getServiceIcon(svc.name);
                return (
                  <div
                    key={svc.id}
                    className="min-w-[150px] flex-1 max-w-[185px] bg-white rounded-2xl border border-pink-100/50 p-4 shadow-sm text-center flex flex-col items-center gap-3 snap-start hover:border-[#cf5b9d] transition-colors"
                  >
                    <div className="size-11 rounded-xl bg-pink-50 flex items-center justify-center text-[#cf5b9d]">
                      <SvcIcon className="size-5.5" />
                    </div>
                    <span className="font-semibold text-xs text-slate-800 line-clamp-1">{svc.name}</span>
                    <span className="text-[10px] text-slate-400 font-medium">Starting from $199</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Before & After — hidden for now */}

        {/* ── Other Clinic Providers ── */}
        {otherProviders.length > 0 && (
          <section className="rounded-[32px] border border-pink-100/60 bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgb(253,244,251,0.5)] flex flex-col gap-6">
            <h2 className="text-2xl font-bold text-slate-900">
              Other providers from {provider.clinic_name}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
              {otherProviders.map((other) => (
                <div key={other.id} className="bg-[#fdfafc]/60 rounded-3xl border border-pink-100/30 p-4 shadow-sm flex flex-col gap-3">
                  <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-slate-50 border border-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={other.image_url || defaultPhoto} alt={other.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="px-1 flex flex-col gap-1">
                    <h4 className="font-semibold text-sm text-slate-800 flex items-center gap-1">
                      {other.name}
                      {other.is_verified && <BadgeCheck className="size-4.5 text-[#cf5b9d] fill-pink-50" />}
                    </h4>
                    <p className="text-xs text-slate-400">{other.title || "Aesthetic Specialist"}</p>
                  </div>
                  <Link
                    href={`/providers/${other.id}/${other.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                    className="mt-2 text-center text-xs font-semibold text-[#cf5b9d] hover:text-[#b6663f] hover:underline py-1.5 rounded-lg border border-pink-100/50 bg-white transition-colors"
                  >
                    View Profile
                  </Link>
                </div>
              ))}
            </div>

            {/* CTA bar at the bottom */}
            <div className="flex flex-wrap gap-4 border-t border-zinc-100 pt-6 mt-2">
              <a
                href={bookUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#e08a4f] to-[#cf5b9d] px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-95"
              >
                <Calendar className="size-4" /> Book Appointment
              </a>
              {provider.clinic_phone && (
                <a
                  href={`tel:${provider.clinic_phone}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d96f8e] px-6 py-3 text-sm font-semibold text-[#9b3a6e] transition hover:bg-pink-50/50"
                >
                  <Phone className="size-4" /> Call Clinic
                </a>
              )}
            </div>
          </section>
        )}

      </div>

      <Footer />
    </main>
  );
}
