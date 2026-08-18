"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search } from "lucide-react";

import { useLocation } from "@/lib/location/location-context";
import {
  LocationTypeahead,
  type LocationSelection,
} from "@/components/ui/location-typeahead";
import { Button } from "@/components/ui/button";

/**
 * Final "find providers near you" search for the static Botox page. The
 * treatment is fixed (Botox); the visitor only picks a location. Mirrors the
 * home hero's location field (typeahead + "use my current location") and routes
 * into the same results page the rest of the site uses: /search?q=Botox&...
 * A faint decorative street map sits behind it so it reads as a "near you" find.
 */
export function BotoxLocationSearch() {
  const router = useRouter();
  const { status, requestLocation } = useLocation();
  const [location, setLocation] = useState("");
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);

  const handleLocationChange = (sel: LocationSelection) => {
    setLocation(sel.value);
    setGeo(sel.lat !== null && sel.lng !== null ? { lat: sel.lat, lng: sel.lng } : null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set("q", "Botox");
    if (location.trim()) params.set("location", location.trim());
    if (geo) {
      params.set("lat", String(geo.lat));
      params.set("lng", String(geo.lng));
    }
    router.push(`/search?${params.toString()}`);
  };

  return (
    <div className="relative rounded-[24px] border border-[#EADCE6] bg-white shadow-[0px_16px_44px_rgba(123,45,107,0.12)]">
      {/* Faint decorative map, clipped to the panel's rounded corners */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[24px]">
        <MapBackdrop className="absolute inset-x-0 bottom-0 h-full w-full opacity-60" />
        {/* fade the top so the heading/search stay crisp */}
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white/85 to-white/40" />
      </div>

      <div className="relative z-10 px-5 py-10 text-center sm:px-10 sm:py-12">
        <h2 className="font-montserrat text-[26px] font-medium leading-[116%] tracking-[-0.03em] text-[#373634] sm:text-[32px]">
          Find Botox providers{" "}
          <span className="font-fraunces font-normal italic">near you</span>
        </h2>
        <p className="mx-auto mt-3 max-w-[560px] text-[15.5px] leading-[1.6] text-zinc-600">
          Enter your location to find and compare licensed med spas offering Botox nearby. See
          the treatments they offer, read real patient reviews, and book directly with the
          practice.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mx-auto mt-7 flex w-full max-w-[620px] flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-2 sm:rounded-[16px] sm:bg-white sm:p-2 sm:shadow-[0px_10px_30px_rgba(170,78,179,0.14)]"
        >
          <div className="flex flex-1 items-center gap-3 rounded-[14px] border border-[#e1e1e1] bg-white px-4 py-3 sm:border-0 sm:py-0 sm:pl-4">
            <MapPin className="size-5 shrink-0 text-brand-magenta" aria-hidden />
            <div className="flex-1 text-left">
              <LocationTypeahead
                value={location}
                onChange={handleLocationChange}
                placeholder="ZIP code or city…"
                onUseMyLocation={() => requestLocation({ force: true })}
                locating={status === "prompting"}
              />
            </div>
          </div>
          <Button type="submit" variant="gradient" size="search" className="sm:w-auto">
            <Search className="size-5" aria-hidden />
            Search
          </Button>
        </form>
      </div>
    </div>
  );
}

/** Purely decorative, self-contained street map with location pins. */
function MapBackdrop({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1200 420"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <rect width="1200" height="420" fill="#faf5fa" />
      {/* soft city blocks */}
      <g fill="#f0e6f1">
        <rect x="60" y="60" width="150" height="90" rx="6" />
        <rect x="250" y="40" width="120" height="120" rx="6" />
        <rect x="470" y="70" width="170" height="80" rx="6" />
        <rect x="720" y="50" width="130" height="110" rx="6" />
        <rect x="930" y="70" width="180" height="90" rx="6" />
        <rect x="90" y="240" width="160" height="110" rx="6" />
        <rect x="330" y="250" width="140" height="100" rx="6" />
        <rect x="560" y="240" width="150" height="120" rx="6" />
        <rect x="800" y="250" width="130" height="100" rx="6" />
        <rect x="1000" y="240" width="140" height="110" rx="6" />
      </g>
      {/* streets */}
      <g stroke="#e3d2e4" strokeWidth="6" fill="none" strokeLinecap="round">
        <path d="M0 200 H1200" />
        <path d="M0 210 H1200" strokeWidth="2" stroke="#efe3ef" />
        <path d="M230 0 V420" />
        <path d="M660 0 V420" />
        <path d="M960 0 V420" />
        <path d="M0 40 H1200" strokeWidth="2" stroke="#efe3ef" />
        <path d="M0 370 H1200" strokeWidth="2" stroke="#efe3ef" />
      </g>
      {/* a curving avenue */}
      <path
        d="M-20 120 C 250 60, 420 260, 700 190 S 1100 120, 1240 220"
        stroke="#e7c6dc"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      {/* location pins */}
      <g>
        <Pin x={230} y={200} scale={1.5} highlight />
        <Pin x={470} y={110} scale={1} />
        <Pin x={760} y={280} scale={1} />
        <Pin x={980} y={160} scale={1.1} />
        <Pin x={120} y={300} scale={0.9} />
      </g>
    </svg>
  );
}

function Pin({
  x,
  y,
  scale = 1,
  highlight = false,
}: {
  x: number;
  y: number;
  scale?: number;
  highlight?: boolean;
}) {
  const color = highlight ? "#CF5B9D" : "#d99cc2";
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <ellipse cx="0" cy="6" rx="10" ry="3" fill="#00000010" />
      <path
        d="M0 -34 C -12 -34 -20 -25 -20 -14 C -20 -2 -6 8 0 14 C 6 8 20 -2 20 -14 C 20 -25 12 -34 0 -34 Z"
        fill={color}
      />
      <circle cx="0" cy="-16" r="7" fill="#ffffff" />
    </g>
  );
}
