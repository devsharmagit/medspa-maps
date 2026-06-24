"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  Crown,
  LocateFixed,
  MapPin,
  Phone,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  SearchableDropdown,
  type DropdownOption,
} from "@/components/ui/searchable-dropdown";
import { cn } from "@/lib/utils";

// ─── Constants ──────────────────────────────────────────────────────────────

/** All 50 US states. */
const STATES: { abbr: string; name: string }[] = [
  { abbr: "AL", name: "Alabama" },
  { abbr: "AK", name: "Alaska" },
  { abbr: "AZ", name: "Arizona" },
  { abbr: "AR", name: "Arkansas" },
  { abbr: "CA", name: "California" },
  { abbr: "CO", name: "Colorado" },
  { abbr: "CT", name: "Connecticut" },
  { abbr: "DE", name: "Delaware" },
  { abbr: "FL", name: "Florida" },
  { abbr: "GA", name: "Georgia" },
  { abbr: "HI", name: "Hawaii" },
  { abbr: "ID", name: "Idaho" },
  { abbr: "IL", name: "Illinois" },
  { abbr: "IN", name: "Indiana" },
  { abbr: "IA", name: "Iowa" },
  { abbr: "KS", name: "Kansas" },
  { abbr: "KY", name: "Kentucky" },
  { abbr: "LA", name: "Louisiana" },
  { abbr: "ME", name: "Maine" },
  { abbr: "MD", name: "Maryland" },
  { abbr: "MA", name: "Massachusetts" },
  { abbr: "MI", name: "Michigan" },
  { abbr: "MN", name: "Minnesota" },
  { abbr: "MS", name: "Mississippi" },
  { abbr: "MO", name: "Missouri" },
  { abbr: "MT", name: "Montana" },
  { abbr: "NE", name: "Nebraska" },
  { abbr: "NV", name: "Nevada" },
  { abbr: "NH", name: "New Hampshire" },
  { abbr: "NJ", name: "New Jersey" },
  { abbr: "NM", name: "New Mexico" },
  { abbr: "NY", name: "New York" },
  { abbr: "NC", name: "North Carolina" },
  { abbr: "ND", name: "North Dakota" },
  { abbr: "OH", name: "Ohio" },
  { abbr: "OK", name: "Oklahoma" },
  { abbr: "OR", name: "Oregon" },
  { abbr: "PA", name: "Pennsylvania" },
  { abbr: "RI", name: "Rhode Island" },
  { abbr: "SC", name: "South Carolina" },
  { abbr: "SD", name: "South Dakota" },
  { abbr: "TN", name: "Tennessee" },
  { abbr: "TX", name: "Texas" },
  { abbr: "UT", name: "Utah" },
  { abbr: "VT", name: "Vermont" },
  { abbr: "VA", name: "Virginia" },
  { abbr: "WA", name: "Washington" },
  { abbr: "WV", name: "West Virginia" },
  { abbr: "WI", name: "Wisconsin" },
  { abbr: "WY", name: "Wyoming" },
];

const STATE_OPTIONS: DropdownOption[] = STATES.map((s) => ({
  label: s.name,
  value: s.abbr,
}));

const RADIUS_OPTIONS = [10, 25, 50, 100];

/** Distance-band radio options → upper-bound radius value. */
const DISTANCE_BANDS: { label: string; radius: number }[] = [
  { label: "10 - 20 miles", radius: 20 },
  { label: "20 - 40 miles", radius: 40 },
  { label: "40 - 80 miles", radius: 80 },
  { label: "80 - 120 miles", radius: 120 },
];

const RATING_BANDS: { label: string; value: string }[] = [
  { label: "4.5 & up", value: "4.5" },
  { label: "4.0 & up", value: "4.0" },
  { label: "5.0 only", value: "5.0" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClinicService {
  name: string;
  slug: string;
}

interface ClinicResult {
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
  featured: boolean;
  tier: string;
  verified: boolean;
  booking_url: string | null;
  logo_url: string | null;
  services: ClinicService[];
  cover_image_url: string | null;
  distance_miles: number | null;
}

// ─── Search Results Component ─────────────────────────────────────────────────

export function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const q = searchParams.get("q") || "";
  const location = searchParams.get("location") || "";
  const radius = searchParams.get("radius") || "";
  const rating = searchParams.get("rating") || "";
  const lat = searchParams.get("lat") || "";
  const lng = searchParams.get("lng") || "";
  const hasOrigin = Boolean(lat && lng);
  const sort = searchParams.get("sort") || (hasOrigin ? "distance" : "rating");

  const [results, setResults] = useState<ClinicResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [geoError, setGeoError] = useState("");

  // Search-bar state
  const [searchService, setSearchService] = useState(q);
  const [searchState, setSearchState] = useState(location);
  const [searchRadius, setSearchRadius] = useState(radius || "25");
  const [serviceOptions, setServiceOptions] = useState<DropdownOption[]>([]);

  // Fetch service options for the dropdown
  useEffect(() => {
    fetch("/api/services")
      .then((r) => r.json())
      .then((data) => {
        if (data.services) {
          setServiceOptions(
            data.services.map((s: { name: string; slug: string }) => ({
              label: s.name,
              value: s.slug,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (location) params.set("location", location);
      if (sort) params.set("sort", sort);
      if (radius) params.set("radius", radius);
      if (rating) params.set("rating", rating);
      if (lat && lng) {
        params.set("lat", lat);
        params.set("lng", lng);
      }

      const res = await fetch(`/api/search?${params.toString()}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setResults(data.results);
      setTotal(data.total);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [q, location, sort, radius, rating, lat, lng]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Sync search fields when URL params change
  useEffect(() => {
    setSearchService(q);
    setSearchState(location);
    setSearchRadius(radius || "25");
  }, [q, location, radius]);

  // Push a new set of params to the URL (which triggers refetch).
  const pushParams = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      router.push(`/search?${params.toString()}`);
    },
    [router, searchParams]
  );

  const updateParam = (key: string, value: string) => {
    pushParams({ [key]: value || null });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    pushParams({
      q: searchService.trim() || null,
      location: searchState.trim() || null,
      radius: searchRadius || null,
    });
  };

  const handleNearMe = () => {
    setGeoError("");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("Geolocation is not available.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        pushParams({
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
          radius: searchRadius || "25",
          sort: "distance",
        });
      },
      () => {
        // Denied/unavailable — continue without distance.
        setGeoError("Location unavailable. Showing results without distance.");
      }
    );
  };

  const clearLocation = () => {
    pushParams({ lat: null, lng: null, sort: null });
  };

  const clearFilters = () => {
    setSearchService("");
    setSearchState("");
    setSearchRadius("25");
    router.push("/search");
  };

  const hasActiveFilters = q || location || rating || radius || hasOrigin;

  // Resolve display label for the title
  const stateName =
    STATES.find((s) => s.abbr.toLowerCase() === location.toLowerCase())?.name ||
    location;
  const serviceName =
    serviceOptions.find((s) => s.value === q)?.label || q || "Treatments";

  // Which distance band (if any) is currently selected
  const activeBandRadius = radius ? Number(radius) : null;

  return (
    <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Top Search Card ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[#e8e0e8] bg-white p-6 shadow-[0_4px_24px_rgba(170,78,179,0.08)] sm:p-7">
        <h1 className="text-2xl font-semibold tracking-tight text-[#1a1a1a] sm:text-3xl">
          {serviceName}{" "}
          {location ? (
            <>
              in{" "}
              <span className="font-fraunces font-normal italic text-brand-magenta">
                {stateName}
              </span>
            </>
          ) : (
            <span className="font-fraunces font-normal italic text-brand-magenta">
              Near Me
            </span>
          )}
        </h1>

        <form
          onSubmit={handleSearch}
          className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-stretch"
        >
          {/* Treatment dropdown */}
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-[#e8e0e8] px-4 py-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-magenta/10">
              <Sparkles className="size-4 text-brand-magenta" aria-hidden />
            </span>
            <SearchableDropdown
              options={serviceOptions}
              value={searchService}
              onChange={setSearchService}
              placeholder="Treatment or clinic…"
              className="flex-1"
              allowFreeText
            />
          </div>

          {/* State dropdown */}
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-[#e8e0e8] px-4 py-2.5">
            <MapPin className="size-5 shrink-0 text-brand-magenta" aria-hidden />
            <SearchableDropdown
              options={STATE_OPTIONS}
              value={searchState}
              onChange={setSearchState}
              placeholder="Select a state…"
              className="flex-1"
            />
          </div>

          {/* Radius dropdown */}
          <div className="flex items-center gap-2 rounded-xl border border-[#e8e0e8] px-4 py-2.5">
            <div className="relative flex items-center">
              <select
                value={searchRadius}
                onChange={(e) => setSearchRadius(e.target.value)}
                className="appearance-none bg-transparent pr-6 text-sm font-medium text-[#4a4a4a] focus:outline-none"
                aria-label="Radius"
              >
                {RADIUS_OPTIONS.map((r) => (
                  <option key={r} value={String(r)}>
                    {r} miles
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-0 size-3.5 text-brand-muted/60" />
            </div>
          </div>

          {/* Near-me button */}
          <button
            type="button"
            onClick={handleNearMe}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors",
              hasOrigin
                ? "border-brand-magenta/40 bg-brand-magenta/10 text-brand-magenta"
                : "border-[#e8e0e8] text-[#4a4a4a] hover:border-brand-magenta/40 hover:text-brand-magenta"
            )}
            aria-label="Use my location"
          >
            <LocateFixed className="size-4" aria-hidden />
            Near Me
          </button>

          {/* Search button */}
          <Button
            type="submit"
            variant="gradient"
            className="h-auto gap-2 rounded-xl px-6 py-3 text-sm font-semibold"
          >
            <Search className="size-4" aria-hidden />
            Search
          </Button>
        </form>

        {/* Location status / errors */}
        {hasOrigin && (
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand-magenta">
            <LocateFixed className="size-3.5" />
            Using your location
            <button
              type="button"
              onClick={clearLocation}
              className="ml-1 text-brand-muted hover:text-brand-magenta"
              aria-label="Stop using location"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}
        {!hasOrigin && geoError && (
          <p className="mt-3 text-xs text-brand-muted">{geoError}</p>
        )}
      </div>

      {/* ── Body: sidebar + results ─────────────────────────────────────── */}
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* ── Filter Sidebar ─────────────────────────────────────────────── */}
        <aside className="w-full shrink-0 lg:w-[260px]">
          <div className="flex flex-col gap-6 rounded-2xl border border-[#ece6ec] bg-white p-5 shadow-sm">
            {/* Distance / Radius */}
            <div>
              <h3 className="text-sm font-semibold text-[#1a1a1a]">
                Distance / Radius
              </h3>
              <div className="mt-3 flex flex-col gap-2.5">
                {DISTANCE_BANDS.map((band) => {
                  const checked = activeBandRadius === band.radius;
                  return (
                    <label
                      key={band.radius}
                      className="flex cursor-pointer items-center gap-2.5 text-sm text-[#4a4a4a]"
                    >
                      <input
                        type="radio"
                        name="distance"
                        checked={checked}
                        onChange={() =>
                          updateParam("radius", String(band.radius))
                        }
                        className="size-4 accent-brand-magenta"
                      />
                      {band.label}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-[#ece6ec]" />

            {/* Rating */}
            <div>
              <h3 className="text-sm font-semibold text-[#1a1a1a]">Rating</h3>
              <div className="mt-3 flex flex-col gap-2.5">
                {RATING_BANDS.map((band) => {
                  const checked = rating === band.value;
                  return (
                    <label
                      key={band.value}
                      className="flex cursor-pointer items-center gap-2.5 text-sm text-[#4a4a4a]"
                    >
                      <input
                        type="radio"
                        name="rating"
                        checked={checked}
                        onChange={() => updateParam("rating", band.value)}
                        className="size-4 accent-brand-magenta"
                      />
                      <span className="inline-flex items-center gap-1">
                        <Star className="size-3.5 fill-[#FFBA19] text-[#FFBA19]" />
                        {band.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="h-px bg-[#ece6ec]" />

            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-[#e8e0e8] px-4 py-2.5 text-sm font-medium text-brand-magenta transition-colors hover:bg-brand-magenta/5"
            >
              <X className="size-3.5" />
              Clear All Filters
            </button>
          </div>
        </aside>

        {/* ── Results column ─────────────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          {/* Results header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-[#1a1a1a]">
              {loading ? "Searching…" : `${total} Clinics Found`}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-brand-muted">Sorted By:</span>
              <div className="relative flex items-center">
                <select
                  value={sort}
                  onChange={(e) => updateParam("sort", e.target.value)}
                  className="appearance-none rounded-xl border border-[#e1e1e1] bg-white py-2 pl-3.5 pr-9 text-sm font-medium text-[#4a4a4a] transition-colors hover:border-brand-magenta/40 focus:outline-none focus:ring-2 focus:ring-brand-magenta/20"
                >
                  <option value="distance">Distance</option>
                  <option value="rating">Rating</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 size-3.5 text-brand-muted" />
              </div>
            </div>
          </div>

          {/* Results list */}
          <div className="mt-6">
            {loading ? (
              <div className="flex flex-col gap-5">
                {[...Array(4)].map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center gap-4 py-20">
                <div className="flex size-16 items-center justify-center rounded-full bg-red-50">
                  <X className="size-8 text-red-400" />
                </div>
                <p className="text-lg font-medium text-[#1a1a1a]">{error}</p>
                <Button variant="gradient" onClick={fetchResults}>
                  Try Again
                </Button>
              </div>
            ) : results.length === 0 ? (
              <EmptyState q={q} location={location} onClear={clearFilters} />
            ) : (
              <div className="flex flex-col gap-5">
                {results.map((clinic) => (
                  <ClinicCard key={clinic.clinic_id} clinic={clinic} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active-filters clear shortcut (mobile convenience) */}
      {hasActiveFilters && !loading && (
        <button
          onClick={clearFilters}
          className="self-center text-xs font-medium text-brand-magenta hover:opacity-70 lg:hidden"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

// ─── Clinic Card ──────────────────────────────────────────────────────────────

function ClinicCard({ clinic }: { clinic: ClinicResult }) {
  const uniqueServices = Array.from(
    new Map(clinic.services.map((s) => [s.slug, s])).values()
  );

  const gallery = clinic.cover_image_url ? [clinic.cover_image_url] : [];
  // Thumbnails: reuse the cover for now (gallery endpoint not wired) — show up
  // to 4 small thumbs with a +N overlay when more would exist.
  const thumbs = gallery.slice(0, 4);
  const extraThumbs = Math.max(0, gallery.length - 4);

  const profileUrl = `/clinics/${clinic.clinic_slug}`;
  const bookUrl = clinic.booking_url || clinic.website || profileUrl;
  const isFeatured = clinic.featured || clinic.verified;

  return (
    <div className="flex flex-col gap-5 overflow-hidden rounded-2xl border border-[#ece6ec] bg-white p-4 shadow-sm transition-shadow hover:shadow-[0_8px_30px_rgba(170,78,179,0.10)] sm:flex-row sm:p-5">
      {/* Left: cover + thumbnails */}
      <div className="w-full shrink-0 sm:w-[220px]">
        <a
          href={profileUrl}
          className="relative block h-[160px] w-full overflow-hidden rounded-xl bg-gradient-to-br from-brand-coral/20 to-brand-purple/20"
        >
          {clinic.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={clinic.cover_image_url}
              alt={clinic.clinic_name}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <span className="text-4xl font-bold text-white/60">
                {clinic.clinic_name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)}
              </span>
            </div>
          )}
          {isFeatured && (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-[#D3A845] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
              <Crown className="size-3" />
              Featured
            </span>
          )}
        </a>

        {thumbs.length > 0 && (
          <div className="mt-2 grid grid-cols-4 gap-2">
            {thumbs.map((src, i) => {
              const isLast = i === thumbs.length - 1;
              return (
                <div
                  key={i}
                  className="relative h-[44px] overflow-hidden rounded-md bg-[#f5f0f5]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    className="size-full object-cover"
                  />
                  {isLast && extraThumbs > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-semibold text-white">
                      +{extraThumbs}
                    </div>
                  )}
                </div>
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
          {clinic.verified && (
            <BadgeCheck className="size-4 shrink-0 fill-brand-magenta text-white" />
          )}
        </a>

        <div className="flex items-center gap-1.5 text-sm text-[#727272]">
          <MapPin className="size-3.5 shrink-0 text-brand-magenta/60" />
          <span className="line-clamp-1">
            {clinic.city}, {clinic.state}
            {clinic.distance_miles != null &&
              `  ·  ${clinic.distance_miles} Miles Away`}
          </span>
        </div>

        {clinic.avg_rating != null && (
          <div className="flex items-center gap-1 text-sm">
            <Star className="size-4 fill-[#FFBA19] text-[#FFBA19]" />
            <span className="font-semibold text-[#1a1a1a]">
              {Number(clinic.avg_rating).toFixed(1)}
            </span>
            <span className="text-[#727272]">({clinic.review_count})</span>
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

      {/* Right: CTAs */}
      <div className="flex shrink-0 flex-col justify-center gap-2.5 sm:w-[180px]">
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
        <Button
          variant="outline"
          className="h-[42px] gap-2 rounded-xl text-sm font-semibold"
          asChild
        >
          <a href={`tel:${clinic.phone}`}>
            <Phone className="size-4" />
            Call Clinic
          </a>
        </Button>
      </div>
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-[#ece6ec] bg-white p-4 shadow-sm sm:flex-row sm:p-5">
      <div className="w-full shrink-0 sm:w-[220px]">
        <div className="h-[160px] w-full animate-pulse rounded-xl bg-gradient-to-br from-[#f5f0f5] to-[#ece6ec]" />
        <div className="mt-2 grid grid-cols-4 gap-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-[44px] animate-pulse rounded-md bg-[#f5f0f5]"
            />
          ))}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3">
        <div className="h-6 w-3/4 animate-pulse rounded-md bg-[#f0eaf0]" />
        <div className="h-4 w-1/2 animate-pulse rounded-md bg-[#f5f0f5]" />
        <div className="h-4 w-1/3 animate-pulse rounded-md bg-[#f5f0f5]" />
        <div className="flex gap-1.5">
          <div className="h-5 w-14 animate-pulse rounded-md bg-[#f5f0f5]" />
          <div className="h-5 w-12 animate-pulse rounded-md bg-[#f5f0f5]" />
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-2.5 sm:w-[180px]">
        <div className="h-[42px] animate-pulse rounded-xl bg-[#f0eaf0]" />
        <div className="h-[42px] animate-pulse rounded-xl bg-[#f5f0f5]" />
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  q,
  location,
  onClear,
}: {
  q: string;
  location: string;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20">
      <div className="relative">
        <div className="flex size-24 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-coral/10 to-brand-purple/10">
          <Search className="size-10 text-brand-magenta/40" />
        </div>
        <div className="absolute -right-1 -top-1 flex size-8 items-center justify-center rounded-full bg-brand-magenta/10">
          <X className="size-4 text-brand-magenta/60" />
        </div>
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold text-[#1a1a1a]">
          No clinics found
        </h2>
        <p className="mt-2 max-w-md text-sm text-brand-muted">
          {q && location
            ? `We couldn't find any clinics matching "${q}" in "${location}". Try broadening your search.`
            : q
              ? `We couldn't find any clinics matching "${q}". Try a different treatment or service name.`
              : location
                ? `We couldn't find any clinics in "${location}". Try a different state.`
                : "Try searching for a treatment or location to find clinics near you."}
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onClear} className="rounded-xl">
          Clear Search
        </Button>
        <Button
          variant="gradient"
          onClick={() => (window.location.href = "/")}
          className="rounded-xl"
        >
          Back to Home
        </Button>
      </div>
    </div>
  );
}
