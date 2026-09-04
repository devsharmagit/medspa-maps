"use client";

/**
 * chat-clinic-cards.tsx — practice cards rendered inside the chat panel.
 *
 * Deliberately NOT the shared <ClinicCard>: that one is ~450px tall (cover
 * image, thumbnail strip, three CTAs) and the chat panel is only ~360px wide
 * and ~600px tall, so three of them would bury the conversation. This follows
 * the narrow-panel precedent already set by MiniPractice in
 * components/blog/treatment-practices.tsx, plus treatment chips and CTAs.
 */
import Link from "next/link";
import { MapPin, Star, ArrowUpRight } from "lucide-react";

export interface ChatClinicCard {
  name: string;
  slug: string;
  url: string;
  city: string | null;
  state: string | null;
  rating: number | null;
  reviews: number;
  treatments: string[];
  booking_url: string | null;
  logo_url?: string | null;
  cover_image_url?: string | null;
  distance_miles?: number | null;
}

export interface ChatClinicPayload {
  clinics: ChatClinicCard[];
  total: number;
  searchUrl: string;
  locationLabel: string | null;
  /** true when nothing matched in the area and these are the nearest instead */
  farAway?: boolean;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ClinicRow({ clinic }: { clinic: ChatClinicCard }) {
  const image = clinic.cover_image_url ?? clinic.logo_url ?? null;
  const city = (clinic.city || "").replace(/[,\s]+$/, "");
  const place = [city, clinic.state].filter(Boolean).join(", ");
  const chips = clinic.treatments.slice(0, 3);

  return (
    <div className="rounded-xl border border-[#ece6ec] bg-white p-2.5">
      <div className="flex gap-2.5">
        <div className="relative size-[52px] shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-brand-coral/20 to-brand-purple/20">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-xs font-semibold text-[#8a6f8a]">
              {initials(clinic.name)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <Link
            href={clinic.url}
            className="line-clamp-1 text-[13px] font-semibold text-[#373634] hover:text-[#CF5B9D]"
          >
            {clinic.name}
          </Link>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-zinc-500">
            {place && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="size-3 shrink-0 text-brand-magenta/60" aria-hidden />
                <span className="line-clamp-1">{place}</span>
              </span>
            )}
            {/* Omit the rating entirely when there isn't one — never "no rating". */}
            {clinic.rating != null && clinic.reviews > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1">
                <Star className="size-3 fill-[#FFBA19] text-[#FFBA19]" aria-hidden />
                {clinic.rating.toFixed(1)}
                <span className="text-zinc-400">({clinic.reviews})</span>
              </span>
            )}
            {clinic.distance_miles != null && (
              <span className="shrink-0 text-zinc-400">
                {clinic.distance_miles < 1
                  ? "under 1 mi"
                  : `${Math.round(clinic.distance_miles)} mi`}
              </span>
            )}
          </div>

          {chips.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {chips.map((t) => (
                <span
                  key={t}
                  className="rounded-md border border-[#ece6ec] bg-[#faf7fa] px-1.5 py-0.5 text-[10px] text-[#8a6f8a]"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex gap-1.5">
        <Link
          href={clinic.url}
          className="flex-1 rounded-lg border border-[#ece6ec] px-2 py-1.5 text-center text-[11px] font-medium text-[#373634] hover:bg-[#faf7fa]"
        >
          View
        </Link>
        {/* Only render Book when there is a real URL — a dead button reads as broken. */}
        {clinic.booking_url && (
          <a
            href={clinic.booking_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg bg-[#CF5B9D] px-2 py-1.5 text-center text-[11px] font-medium text-white hover:bg-[#b94d8a]"
          >
            Book
          </a>
        )}
      </div>
    </div>
  );
}

/** Mirror of the server cap — the panel must never show more than this. */
const MAX_CARDS = 5;

export default function ChatClinicCards({ payload }: { payload: ChatClinicPayload }) {
  const { total, searchUrl, locationLabel, farAway } = payload;
  const clinics = payload.clinics.slice(0, MAX_CARDS);
  if (!clinics.length) return null;

  const remaining = total - clinics.length;

  return (
    <div className="mt-2 space-y-2">
      {farAway && (
        <p className="text-[11px] text-zinc-500">
          Nothing inside the search area
          {locationLabel ? ` around ${locationLabel}` : ""} — these are the nearest instead.
        </p>
      )}

      {clinics.map((c) => (
        <ClinicRow key={c.slug} clinic={c} />
      ))}

      {remaining > 0 && (
        <Link
          href={searchUrl}
          className="flex items-center justify-center gap-1 rounded-lg border border-[#ece6ec] bg-[#faf7fa] px-3 py-2 text-[11.5px] font-medium text-[#8a6f8a] hover:bg-[#f3ecf3]"
        >
          See all {total} results
          <ArrowUpRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}
