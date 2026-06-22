import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  BadgeCheck,
  Clock,
  Crown,
  ExternalLink,
  Globe,
  Link2,
  MapPin,
  Phone,
  Star,
} from "lucide-react";

import { HeroHeader } from "@/components/hero/hero-header";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClinicService {
  name: string;
  slug: string;
  category: string | null;
  description: string | null;
}

interface GalleryImage {
  id: string;
  url: string;
  cdn_url: string | null;
  alt_text: string | null;
  role: string;
}

interface ClinicDetail {
  clinic_id: string;
  clinic_slug: string;
  clinic_name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  booking_url: string | null;
  about: string | null;
  hours: Record<string, { open: string; close: string; is_open: boolean }> | null;
  avg_rating: number | null;
  review_count: number;
  featured: boolean;
  tier: string;
  verified: boolean;
  google_place_id: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
  x_url: string | null;
  linkedin_url: string | null;
  yelp_url: string | null;
  google_my_business: string | null;
  business_id: string;
  business_name: string;
  logo_url: string | null;
  cover_image_url: string | null;
  gallery_images: GalleryImage[];
  services: ClinicService[];
}

// ─── Data Fetching ────────────────────────────────────────────────────────────

async function getClinic(slug: string): Promise<ClinicDetail | null> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const res = await fetch(`${baseUrl}/api/clinics/${slug}`, { next: { revalidate: 300 } });
  if (!res.ok) return null;
  const data = await res.json();
  return data.clinic ?? null;
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const clinic = await getClinic(slug);
  if (!clinic) return { title: "Clinic Not Found | MedSpa Map" };
  return {
    title: `${clinic.clinic_name} | MedSpa Map`,
    description: clinic.about?.slice(0, 155) ?? `Book at ${clinic.clinic_name} in ${clinic.city}, ${clinic.state}`,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_ORDER = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const DAY_SHORT: Record<string, string> = {
  MONDAY: "Mon", TUESDAY: "Tue", WEDNESDAY: "Wed",
  THURSDAY: "Thu", FRIDAY: "Fri", SATURDAY: "Sat", SUNDAY: "Sun",
};

function buildMapsUrl(clinic: ClinicDetail) {
  if (clinic.google_place_id) {
    return `https://www.google.com/maps/place/?q=place_id:${clinic.google_place_id}`;
  }
  const parts = [clinic.address, clinic.city, clinic.state, clinic.zip].filter(Boolean);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(", "))}`;
}

function getTodayStatus(hours: ClinicDetail["hours"]) {
  if (!hours) return null;
  const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const today = days[new Date().getDay()];
  const h = hours[today];
  if (!h || !h.is_open) return { isOpen: false, text: "Closed Today" };
  return { isOpen: true, text: `Open · ${h.open} – ${h.close}` };
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default async function ClinicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const clinic = await getClinic(slug);
  if (!clinic) notFound();

  const mapsUrl = buildMapsUrl(clinic);
  const todayStatus = getTodayStatus(clinic.hours);
  const bookUrl = clinic.booking_url || clinic.website || "#";

  // Group services by category
  const servicesByCategory = clinic.services.reduce<Record<string, ClinicService[]>>(
    (acc, svc) => {
      const cat = svc.category || "Other Services";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(svc);
      return acc;
    },
    {}
  );

  return (
    <main className="flex min-h-screen flex-col bg-[#FDFDFD]">
      {/* Header */}
      <div className="bg-hero-gradient">
        <HeroHeader />
      </div>

      {/* Cover hero */}
      <div className="relative h-[300px] w-full overflow-hidden bg-gradient-to-br from-brand-coral/20 to-brand-purple/20 sm:h-[380px]">
        {clinic.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clinic.cover_image_url}
            alt={clinic.clinic_name}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <span className="text-8xl font-bold text-white/30">
              {clinic.clinic_name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        {/* Tier badge */}
        <div className="absolute left-4 top-4 flex gap-2">
          {clinic.featured && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#D3A845] px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-lg">
              <Crown className="size-3" /> Featured
            </span>
          )}
          {clinic.tier === "elite" && !clinic.featured && (
            <span className="inline-flex items-center gap-1 rounded-md bg-brand-purple px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-lg">
              <Crown className="size-3" /> Elite
            </span>
          )}
        </div>

        {/* Rating pill */}
        {clinic.avg_rating && (
          <div className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-sm">
            <Star className="size-4 fill-[#FFBA19] text-[#FFBA19]" />
            <span className="text-sm font-bold text-white">{Number(clinic.avg_rating).toFixed(1)}</span>
            <span className="text-xs text-white/70">({clinic.review_count} reviews)</span>
          </div>
        )}
      </div>

      {/* ── Main content area ── */}
      <div className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">

          {/* ── Left column — main info ── */}
          <div className="flex flex-1 flex-col gap-8 min-w-0">

            {/* Identity block: logo + name */}
            <div className="flex items-start gap-4">
              {clinic.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={clinic.logo_url}
                  alt={`${clinic.business_name} logo`}
                  className="size-[72px] shrink-0 rounded-xl border border-[#ece6ec] bg-white object-contain p-1 shadow-sm"
                />
              ) : (
                <div className="flex size-[72px] shrink-0 items-center justify-center rounded-xl border border-[#ece6ec] bg-gradient-to-br from-brand-coral/20 to-brand-purple/20 text-xl font-bold text-brand-magenta shadow-sm">
                  {clinic.clinic_name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-[#1a1a1a] sm:text-3xl">
                    {clinic.clinic_name}
                  </h1>
                  {clinic.verified && (
                    <span title="Verified">
                      <BadgeCheck className="size-6 shrink-0 text-brand-magenta" />
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-brand-muted">{clinic.business_name}</p>
                {(clinic.city || clinic.state) && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1.5 text-sm text-[#727272] transition-colors hover:text-brand-magenta"
                  >
                    <MapPin className="size-4 shrink-0 text-brand-magenta/60" />
                    {[clinic.address, clinic.city, clinic.state, clinic.zip].filter(Boolean).join(", ")}
                    <ExternalLink className="size-3 opacity-50" />
                  </a>
                )}
              </div>
            </div>

            {/* Open status + today hours */}
            {todayStatus && (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium",
                  todayStatus.isOpen
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-600"
                )}
              >
                <Clock className="size-4 shrink-0" />
                {todayStatus.text}
              </div>
            )}

            {/* About */}
            {clinic.about && (
              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-[#1a1a1a]">About</h2>
                <p className="text-sm leading-relaxed text-brand-muted">{clinic.about}</p>
              </section>
            )}

            {/* Services */}
            {clinic.services.length > 0 && (
              <section className="flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-[#1a1a1a]">Services Offered</h2>
                {Object.entries(servicesByCategory).map(([cat, svcs]) => (
                  <div key={cat} className="flex flex-col gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
                      {cat}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {svcs.map((svc) => (
                        <div
                          key={svc.slug}
                          className="group relative flex flex-col rounded-xl border border-[#ece6ec] bg-white px-3.5 py-2.5 shadow-sm transition-all hover:border-brand-magenta/30 hover:shadow-md"
                        >
                          <span className="text-sm font-medium text-[#1a1a1a]">{svc.name}</span>
                          {svc.description && (
                            <span className="mt-0.5 text-xs text-brand-muted line-clamp-1">
                              {svc.description}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* Hours */}
            {clinic.hours && Object.keys(clinic.hours).length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-[#1a1a1a]">Hours</h2>
                <div className="overflow-hidden rounded-xl border border-[#ece6ec] bg-white">
                  {DAY_ORDER.filter((d) => clinic.hours![d] !== undefined).map((day, idx) => {
                    const h = clinic.hours![day];
                    const isToday =
                      DAY_ORDER.indexOf(day) ===
                      ((new Date().getDay() + 6) % 7); // shift Sun=0 → Mon=0
                    return (
                      <div
                        key={day}
                        className={cn(
                          "flex items-center justify-between px-4 py-3 text-sm",
                          idx !== 0 && "border-t border-[#f5f0f5]",
                          isToday && "bg-brand-magenta/5"
                        )}
                      >
                        <span className={cn("font-medium", isToday && "text-brand-magenta")}>
                          {DAY_SHORT[day]}
                          {isToday && (
                            <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-brand-magenta">
                              Today
                            </span>
                          )}
                        </span>
                        {h.is_open ? (
                          <span className="text-[#1a1a1a]">
                            {h.open} – {h.close}
                          </span>
                        ) : (
                          <span className="text-red-400">Closed</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Gallery */}
            {clinic.gallery_images.length > 0 && (
              <section className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold text-[#1a1a1a]">Gallery</h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {clinic.gallery_images.map((img) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={img.id}
                      src={img.cdn_url || img.url}
                      alt={img.alt_text || clinic.clinic_name}
                      className="aspect-square w-full rounded-xl object-cover"
                    />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ── Right sidebar ── */}
          <aside className="flex w-full flex-col gap-5 lg:w-[320px] lg:shrink-0">

            {/* CTA card */}
            <div className="flex flex-col gap-3 rounded-2xl border border-[#ece6ec] bg-white p-5 shadow-sm">
              <Button variant="gradient" className="h-[46px] w-full rounded-xl text-sm font-semibold" asChild>
                <a href={bookUrl} target="_blank" rel="noopener noreferrer">
                  Book Appointment
                </a>
              </Button>
              {clinic.phone && (
                <a
                  href={`tel:${clinic.phone}`}
                  className="flex h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-brand-magenta/30 text-sm font-semibold text-brand-magenta transition-colors hover:bg-brand-magenta/5"
                >
                  <Phone className="size-4" />
                  {clinic.phone}
                </a>
              )}
              {clinic.website && (
                <a
                  href={clinic.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-[#e1e1e1] text-sm font-semibold text-[#727272] transition-colors hover:border-brand-magenta/30 hover:text-brand-magenta"
                >
                  <Globe className="size-4" />
                  Visit Website
                </a>
              )}
            </div>

            {/* Contact & location */}
            <div className="flex flex-col gap-4 rounded-2xl border border-[#ece6ec] bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-brand-muted">
                Location & Contact
              </h3>
              {(clinic.address || clinic.city) && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 text-sm text-[#727272] transition-colors hover:text-brand-magenta"
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-brand-magenta" />
                  <span>
                    {[clinic.address, clinic.city, clinic.state, clinic.zip].filter(Boolean).join(", ")}
                  </span>
                </a>
              )}
              {clinic.phone && (
                <a
                  href={`tel:${clinic.phone}`}
                  className="flex items-center gap-3 text-sm text-[#727272] transition-colors hover:text-brand-magenta"
                >
                  <Phone className="size-4 shrink-0 text-brand-magenta" />
                  {clinic.phone}
                </a>
              )}
              {clinic.email && (
                <a
                  href={`mailto:${clinic.email}`}
                  className="flex items-center gap-3 text-sm text-[#727272] transition-colors hover:text-brand-magenta"
                >
                  <Globe className="size-4 shrink-0 text-brand-magenta" />
                  {clinic.email}
                </a>
              )}
            </div>

            {/* Online presence */}
            {(clinic.instagram_url ||
              clinic.facebook_url ||
              clinic.youtube_url ||
              clinic.linkedin_url ||
              clinic.yelp_url ||
              clinic.google_my_business) && (
              <div className="flex flex-col gap-4 rounded-2xl border border-[#ece6ec] bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-brand-muted">
                  Online Presence
                </h3>
                <div className="flex flex-wrap gap-2">
                  {clinic.instagram_url && (
                    <SocialLink href={clinic.instagram_url} label="Instagram">
                      <Link2 className="size-4" />
                    </SocialLink>
                  )}
                  {clinic.facebook_url && (
                    <SocialLink href={clinic.facebook_url} label="Facebook">
                      <Link2 className="size-4" />
                    </SocialLink>
                  )}
                  {clinic.youtube_url && (
                    <SocialLink href={clinic.youtube_url} label="YouTube">
                      <Link2 className="size-4" />
                    </SocialLink>
                  )}
                  {clinic.linkedin_url && (
                    <SocialLink href={clinic.linkedin_url} label="LinkedIn">
                      <Link2 className="size-4" />
                    </SocialLink>
                  )}
                  {clinic.yelp_url && (
                    <SocialLink href={clinic.yelp_url} label="Yelp">
                      <Star className="size-4" />
                    </SocialLink>
                  )}
                  {clinic.google_my_business && (
                    <SocialLink href={clinic.google_my_business} label="Google">
                      <Globe className="size-4" />
                    </SocialLink>
                  )}
                </div>
              </div>
            )}

            {/* Back to search */}
            <Link
              href="/search"
              className="flex items-center justify-center gap-2 rounded-xl border border-[#e1e1e1] py-3 text-sm font-medium text-brand-muted transition-colors hover:border-brand-magenta/30 hover:text-brand-magenta"
            >
              ← Back to Search
            </Link>
          </aside>
        </div>
      </div>

      <Footer />
    </main>
  );
}

// ─── Social Link ──────────────────────────────────────────────────────────────

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ece6ec] bg-white text-[#727272] transition-all hover:border-brand-magenta/30 hover:text-brand-magenta hover:shadow-sm"
    >
      {children}
    </a>
  );
}
