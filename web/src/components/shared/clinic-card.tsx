import {
  CalendarDays,
  Crown,
  Eye,
  Images,
  MapPin,
  Phone,
  Star,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { toStateCode } from "@/lib/location/states";
import { cn } from "@/lib/utils";

// Server-renderable clinic card, shared by the /search results grid and the
// /locations/[state] landing grid. It uses no React hooks, so it renders in a
// server component and lands in the initial HTML (crawlable). Its shape is
// exactly what `searchClinics()` returns per row. No pricing is ever shown.

export interface ClinicService {
  name: string;
  slug: string;
}

export interface ClinicLocation {
  id: string;
  label: string | null;
  city: string | null;
  state: string | null;
  is_primary: boolean;
}

export interface ClinicResult {
  clinic_id: string;
  clinic_name: string;
  clinic_slug: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  website: string | null;
  lat: number;
  lng: number;
  avg_rating: number | null;
  review_count: number;
  ext_rating: number | null;
  ext_review_count: number | null;
  featured: boolean;
  booking_url: string | null;
  logo_url: string | null;
  services: ClinicService[];
  cover_image_url: string | null;
  gallery_images: string[];
  location_count: number;
  locations: ClinicLocation[];
  distance_miles: number | null;
}

export function ClinicCard({
  clinic,
  compact = false,
}: {
  clinic: ClinicResult;
  /** Vertical layout for the narrow list beside the map. */
  compact?: boolean;
}) {
  const uniqueServices = Array.from(
    new Map(clinic.services.map((s) => [s.slug, s])).values()
  );

  // Real photo strip from the API: cover first, then gallery / before-after.
  const images =
    clinic.gallery_images && clinic.gallery_images.length > 0
      ? clinic.gallery_images
      : clinic.cover_image_url
        ? [clinic.cover_image_url]
        : [];
  const cover = images[0] ?? null;
  const thumbs = images.slice(1, 5);
  const extraThumbs = Math.max(0, images.length - 1 - thumbs.length);

  // Rating: internal average first, else external/Google rating.
  const ratingRaw = clinic.avg_rating ?? clinic.ext_rating;
  const ratingValue = ratingRaw != null ? Number(ratingRaw) : null;
  const reviewCount =
    clinic.avg_rating != null ? clinic.review_count : clinic.ext_review_count;

  // Multi-location awareness.
  const locationCount = clinic.location_count || clinic.locations?.length || 1;
  const otherCities = (clinic.locations || [])
    .map((l) =>
      l.city
        ? `${l.city}${l.state ? `, ${toStateCode(l.state) ?? l.state}` : ""}`
        : null
    )
    .filter((c): c is string => Boolean(c));

  const stateCode = toStateCode(clinic.state) ?? clinic.state;
  // Some scraped cities carry trailing punctuation ("Yardley,"); tidy for display.
  const cityLabel = (clinic.city || "").replace(/[,\s]+$/, "");
  const initials = clinic.clinic_name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2);

  const profileUrl = `/practices/${clinic.clinic_slug}`;
  const bookUrl = clinic.booking_url || clinic.website || profileUrl;

  return (
    <div
      data-clinic-id={clinic.clinic_id}
      className={cn(
        "flex scroll-mt-24 flex-col gap-5 overflow-hidden rounded-2xl border border-[#ece6ec] bg-white p-4 shadow-sm transition-shadow hover:shadow-[0_8px_30px_rgba(170,78,179,0.10)]",
        compact ? "" : "sm:flex-row sm:p-5",
      )}
    >
      {/* Left: cover + thumbnails */}
      <div className={cn("w-full", compact ? "" : "shrink-0 sm:w-[220px]")}>
        <a
          href={profileUrl}
          className="relative block h-[160px] w-full overflow-hidden rounded-xl bg-gradient-to-br from-brand-coral/20 to-brand-purple/20"
        >
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt={clinic.clinic_name}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <span className="text-4xl font-bold text-white/60">
                {initials}
              </span>
            </div>
          )}
          {clinic.featured && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-[#D3A845] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
              <Crown className="size-3" />
              Featured
            </span>
          )}
          {images.length > 1 && (
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">
              <Images className="size-3" />
              {images.length}
            </span>
          )}
        </a>

        {thumbs.length > 0 && (
          <div className="mt-2 grid grid-cols-4 gap-2">
            {thumbs.map((src, i) => {
              const isLast = i === thumbs.length - 1;
              return (
                <a
                  href={profileUrl}
                  key={i}
                  className="relative block h-[44px] overflow-hidden rounded-md bg-[#f5f0f5]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="size-full object-cover" />
                  {isLast && extraThumbs > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-semibold text-white">
                      +{extraThumbs}
                    </div>
                  )}
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* Middle: details */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <a href={profileUrl} className="flex items-center gap-1.5">
          <h3 className="line-clamp-1 text-lg font-semibold text-[#1a1a1a] transition-colors hover:text-brand-magenta">
            {clinic.clinic_name}
          </h3>
        </a>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#727272]">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0 text-brand-magenta/60" />
            <span className="line-clamp-1">
              {cityLabel}, {stateCode}
            </span>
          </span>
          {clinic.distance_miles != null && (
            <span className="text-[#9a9a9a]">
              · {clinic.distance_miles} mi away
            </span>
          )}
          {locationCount > 1 && (
            <span
              title={otherCities.join(" • ")}
              className="inline-flex items-center gap-1 rounded-full border border-brand-magenta/20 bg-brand-magenta/5 px-2 py-0.5 text-[11px] font-medium text-brand-magenta"
            >
              <MapPin className="size-3" />
              {locationCount} locations
            </span>
          )}
        </div>

        {ratingValue != null && (
          <div className="flex items-center gap-1 text-sm">
            <Star className="size-4 fill-[#FFBA19] text-[#FFBA19]" />
            <span className="font-semibold text-[#1a1a1a]">
              {ratingValue.toFixed(1)}
            </span>
            {reviewCount != null && reviewCount > 0 && (
              <span className="text-[#727272]">({reviewCount} reviews)</span>
            )}
          </div>
        )}

        {uniqueServices.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {uniqueServices.slice(0, 3).map((svc) => (
              <span
                key={svc.slug}
                className="rounded-md border border-[#ece6ec] bg-[#faf7fa] px-2 py-0.5 text-[11px] font-medium text-[#8a6f8a]"
              >
                {svc.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Right: CTAs (no pricing shown) */}
      <div className={cn("flex flex-col justify-center gap-2.5", compact ? "" : "shrink-0 sm:w-[180px]")}>
        <Button
          variant="gradient"
          className="h-[42px] gap-2 rounded-xl text-sm font-semibold"
          asChild
        >
          <a href={bookUrl} target="_blank" rel="noreferrer">
            <CalendarDays className="size-4" />
            Book Appointment
          </a>
        </Button>
        {/* Call + View sit side by side on mobile to cut clutter; the desktop
            non-compact card stacks them again in its narrow right column. */}
        <div className={cn("flex gap-2.5", compact ? "" : "sm:flex-col")}>
          <Button
            variant="outline"
            className="h-[42px] flex-1 sm:flex-none gap-2 rounded-xl text-sm font-semibold"
            asChild
          >
            <a href={`tel:${clinic.phone}`}>
              <Phone className="size-4" />
              Call Practice
            </a>
          </Button>
          <Button
            variant="outline"
            className="h-[42px] flex-1 sm:flex-none gap-2 rounded-xl text-sm font-semibold"
            asChild
          >
            <a href={profileUrl}>
              <Eye className="size-4" />
              View Practice
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
