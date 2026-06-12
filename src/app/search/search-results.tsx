"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpDown,
  BadgeCheck,
  Clock,
  Crown,
  MapPin,
  Phone,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClinicService {
  name: string;
  slug: string;
  price_from: number | null;
  price_to: number | null;
}

interface ClinicProvider {
  name: string;
  title: string;
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
  lat: number;
  lng: number;
  avg_rating: number | null;
  review_count: number;
  featured: boolean;
  tier: string;
  verified: boolean;
  about: string;
  hours: Record<string, { open: string; close: string; is_open: boolean }> | null;
  booking_url: string | null;
  business_id: string;
  business_name: string;
  business_slug: string;
  logo_url: string | null;
  services: ClinicService[];
  cover_image_url: string | null;
  providers: ClinicProvider[];
}

// ─── Search Results Component ─────────────────────────────────────────────────

export function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const q = searchParams.get("q") || "";
  const location = searchParams.get("location") || "";
  const sort = searchParams.get("sort") || "rating";
  const tier = searchParams.get("tier") || "";

  const [results, setResults] = useState<ClinicResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search bar state
  const [searchService, setSearchService] = useState(q);
  const [searchLocation, setSearchLocation] = useState(location);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (location) params.set("location", location);
      if (sort) params.set("sort", sort);
      if (tier) params.set("tier", tier);

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
  }, [q, location, sort, tier]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Sync search fields when URL params change
  useEffect(() => {
    setSearchService(q);
    setSearchLocation(location);
  }, [q, location]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchService.trim()) params.set("q", searchService.trim());
    if (searchLocation.trim()) params.set("location", searchLocation.trim());
    if (sort !== "rating") params.set("sort", sort);
    if (tier) params.set("tier", tier);
    router.push(`/search?${params.toString()}`);
  };

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/search?${params.toString()}`);
  };

  const clearFilters = () => {
    setSearchService("");
    setSearchLocation("");
    router.push("/search");
  };

  // Determine if today is open
  const getOpenStatus = (
    hours: Record<string, { open: string; close: string; is_open: boolean }> | null
  ) => {
    if (!hours) return null;
    const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const today = days[new Date().getDay()];
    const todayHours = hours[today];
    if (!todayHours || !todayHours.is_open) return { isOpen: false, text: "Closed Today" };
    return { isOpen: true, text: `Open · ${todayHours.open} – ${todayHours.close}` };
  };

  const hasActiveFilters = q || location || tier;

  return (
    <div className="mx-auto flex w-full max-w-[1380px] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Search Bar ──────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSearch}
        className="flex w-full flex-col overflow-hidden rounded-2xl border border-[#e8e0e8] bg-white shadow-[0_4px_24px_rgba(170,78,179,0.08)] sm:flex-row sm:items-stretch sm:h-[68px]"
      >
        {/* Service input */}
        <div className="flex flex-1 items-center gap-3 px-5 py-3 sm:py-0 sm:pl-6">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-magenta/10">
            <Sparkles className="size-4 text-brand-magenta" aria-hidden />
          </span>
          <input
            type="search"
            value={searchService}
            onChange={(e) => setSearchService(e.target.value)}
            placeholder="Treatment, condition, or clinic name…"
            className="w-full border-0 bg-transparent p-0 text-sm text-foreground placeholder:text-brand-placeholder focus:outline-none focus:ring-0"
            aria-label="Search services"
          />
        </div>

        {/* Divider */}
        <div className="hidden sm:flex items-center">
          <div className="h-[36px] w-px bg-[#e1e1e1]" />
        </div>

        {/* Location input */}
        <div className="flex flex-1 items-center gap-3 border-t border-[#e1e1e1] px-5 py-3 sm:border-t-0 sm:py-0 sm:pl-5">
          <MapPin className="size-5 shrink-0 text-brand-magenta" aria-hidden />
          <input
            type="search"
            value={searchLocation}
            onChange={(e) => setSearchLocation(e.target.value)}
            placeholder='City, state, or zip…'
            className="w-full border-0 bg-transparent p-0 text-sm text-foreground placeholder:text-brand-placeholder focus:outline-none focus:ring-0"
            aria-label="Search location"
          />
        </div>

        {/* Search button */}
        <div className="flex items-center px-3 pb-3 sm:px-3.5 sm:pb-0">
          <Button
            type="submit"
            variant="gradient"
            className="h-[44px] gap-2 rounded-xl px-6 text-sm font-semibold"
          >
            <Search className="size-4" aria-hidden />
            Search
          </Button>
        </div>
      </form>

      {/* ── Results Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[#1a1a1a] sm:text-3xl">
            {q && location
              ? <>
                  <span className="bg-gradient-to-r from-brand-coral to-brand-purple bg-clip-text text-transparent">{q}</span>
                  {" "}in{" "}
                  <span className="bg-gradient-to-r from-brand-purple to-brand-coral bg-clip-text text-transparent">{location}</span>
                </>
              : q
                ? <>Results for <span className="bg-gradient-to-r from-brand-coral to-brand-purple bg-clip-text text-transparent">&ldquo;{q}&rdquo;</span></>
                : location
                  ? <>Clinics in <span className="bg-gradient-to-r from-brand-coral to-brand-purple bg-clip-text text-transparent">{location}</span></>
                  : "All Clinics"
            }
          </h1>
          {!loading && (
            <p className="text-sm text-brand-muted">
              {total} {total === 1 ? "result" : "results"} found
            </p>
          )}
        </div>

        {/* Sort & filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tier filter pills */}
          {(["elite", "featured", "free"] as const).map((t) => (
            <button
              key={t}
              onClick={() => updateParam("tier", tier === t ? "" : t)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all",
                tier === t
                  ? "bg-brand-magenta text-white shadow-md shadow-brand-magenta/20"
                  : "border border-[#e1e1e1] bg-white text-brand-muted hover:border-brand-magenta/40 hover:text-brand-magenta"
              )}
            >
              {t === "elite" && <Crown className="size-3" />}
              {t}
            </button>
          ))}

          {/* Sort dropdown */}
          <div className="relative ml-2">
            <select
              value={sort}
              onChange={(e) => updateParam("sort", e.target.value)}
              className="appearance-none rounded-full border border-[#e1e1e1] bg-white py-1.5 pl-3.5 pr-8 text-xs font-semibold uppercase tracking-wider text-brand-muted transition-colors hover:border-brand-magenta/40 focus:outline-none focus:ring-2 focus:ring-brand-magenta/20"
            >
              <option value="rating">Top Rated</option>
              <option value="reviews">Most Reviews</option>
              <option value="name">A → Z</option>
            </select>
            <ArrowUpDown className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-brand-muted" />
          </div>

          {/* Clear all */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs font-medium text-brand-magenta transition-opacity hover:opacity-70"
            >
              <X className="size-3" />
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* ── Active filter tags ──────────────────────────────────────────── */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 -mt-4">
          {q && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-magenta/10 px-3 py-1 text-xs font-medium text-brand-magenta">
              <Sparkles className="size-3" /> {q}
              <button onClick={() => updateParam("q", "")} className="ml-1 hover:opacity-70"><X className="size-3" /></button>
            </span>
          )}
          {location && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-coral/10 px-3 py-1 text-xs font-medium text-brand-coral">
              <MapPin className="size-3" /> {location}
              <button onClick={() => updateParam("location", "")} className="ml-1 hover:opacity-70"><X className="size-3" /></button>
            </span>
          )}
        </div>
      )}

      {/* ── Results Grid ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
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
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((clinic) => (
            <ClinicCard
              key={clinic.clinic_id}
              clinic={clinic}
              openStatus={getOpenStatus(clinic.hours)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Clinic Card ──────────────────────────────────────────────────────────────

function ClinicCard({
  clinic,
  openStatus,
}: {
  clinic: ClinicResult;
  openStatus: { isOpen: boolean; text: string } | null;
}) {
  const lowestPrice = clinic.services
    .map((s) => s.price_from)
    .filter((p): p is number => p !== null)
    .sort((a, b) => a - b)[0];

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(170,78,179,0.12)]",
        clinic.featured
          ? "border-brand-magenta/30 shadow-[0_4px_20px_rgba(170,78,179,0.08)]"
          : "border-[#ece6ec] shadow-sm"
      )}
    >
      {/* Cover image area */}
      <div className="relative h-[200px] w-full overflow-hidden bg-gradient-to-br from-brand-coral/20 to-brand-purple/20">
        {clinic.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clinic.cover_image_url}
            alt={clinic.clinic_name}
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <span className="text-5xl font-bold text-white/60">
              {clinic.clinic_name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)}
            </span>
          </div>
        )}

        {/* Badges overlay */}
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {clinic.featured && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#D3A845] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg">
              <Crown className="size-3" />
              Featured
            </span>
          )}
          {clinic.tier === "elite" && !clinic.featured && (
            <span className="inline-flex items-center gap-1 rounded-md bg-brand-purple px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-lg">
              <Crown className="size-3" />
              Elite
            </span>
          )}
        </div>

        {/* Verified badge */}
        {clinic.verified && (
          <div className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur-sm">
            <BadgeCheck className="size-5 text-brand-magenta" />
          </div>
        )}

        {/* Rating overlay pill */}
        {clinic.avg_rating && (
          <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-sm">
            <Star className="size-3.5 fill-[#FFBA19] text-[#FFBA19]" />
            <span className="text-xs font-bold text-white">{Number(clinic.avg_rating).toFixed(1)}</span>
            <span className="text-[10px] text-white/70">({clinic.review_count})</span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        {/* Name + location */}
        <div>
          <h3 className="line-clamp-1 text-[17px] font-semibold leading-tight text-[#1a1a1a] group-hover:text-brand-magenta transition-colors">
            {clinic.clinic_name}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-[#727272]">
            <MapPin className="size-3.5 shrink-0 text-brand-magenta/60" />
            <span className="line-clamp-1">
              {clinic.city}, {clinic.state}
              {clinic.address && ` · ${clinic.address}`}
            </span>
          </div>
        </div>

        {/* Open status */}
        {openStatus && (
          <div className="flex items-center gap-1.5 text-xs">
            <Clock className="size-3.5" />
            <span className={openStatus.isOpen ? "text-emerald-600 font-medium" : "text-red-400 font-medium"}>
              {openStatus.text}
            </span>
          </div>
        )}

        {/* Services tags */}
        <div className="flex flex-wrap gap-1.5">
          {clinic.services.slice(0, 4).map((svc) => (
            <span
              key={svc.slug}
              className="rounded-md border border-[#ece6ec] bg-[#faf7fa] px-2 py-0.5 text-[11px] font-medium text-[#8a6f8a] transition-colors hover:border-brand-magenta/30 hover:bg-brand-magenta/5"
            >
              {svc.name}
            </span>
          ))}
          {clinic.services.length > 4 && (
            <span className="rounded-md bg-brand-magenta/8 px-2 py-0.5 text-[11px] font-medium text-brand-magenta">
              +{clinic.services.length - 4} more
            </span>
          )}
        </div>

        {/* Price & phone */}
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="flex flex-col">
            {lowestPrice && (
              <span className="text-sm font-semibold text-[#1a1a1a]">
                From <span className="text-brand-magenta">${lowestPrice}</span>
              </span>
            )}
            {clinic.phone && (
              <a
                href={`tel:${clinic.phone}`}
                className="flex items-center gap-1 text-[11px] text-[#727272] transition-colors hover:text-brand-magenta"
              >
                <Phone className="size-3" />
                {clinic.phone}
              </a>
            )}
          </div>

          {/* Providers badges */}
          {clinic.providers.length > 0 && (
            <div className="flex items-center">
              {clinic.providers.slice(0, 2).map((prov, i) => (
                <div
                  key={prov.slug}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-brand-coral/80 to-brand-purple/80 text-[10px] font-bold text-white shadow-sm",
                    i > 0 && "-ml-2"
                  )}
                  title={`${prov.name}, ${prov.title}`}
                >
                  {prov.name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)}
                </div>
              ))}
              {clinic.providers.length > 2 && (
                <div className="-ml-2 flex size-8 items-center justify-center rounded-full border-2 border-white bg-[#f0e6f2] text-[10px] font-bold text-brand-magenta shadow-sm">
                  +{clinic.providers.length - 2}
                </div>
              )}
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            className="flex-1 h-[38px] rounded-xl border-brand-magenta/30 text-xs font-semibold text-brand-magenta hover:bg-brand-magenta/5 hover:text-brand-magenta"
          >
            View Profile
          </Button>
          <Button
            variant="gradient"
            className="flex-1 h-[38px] rounded-xl text-xs font-semibold"
          >
            Book Now
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[#ece6ec] bg-white shadow-sm">
      <div className="h-[200px] animate-pulse bg-gradient-to-br from-[#f5f0f5] to-[#ece6ec]" />
      <div className="flex flex-col gap-3 p-5">
        <div className="h-5 w-3/4 animate-pulse rounded-md bg-[#f0eaf0]" />
        <div className="h-3 w-1/2 animate-pulse rounded-md bg-[#f5f0f5]" />
        <div className="flex gap-1.5">
          <div className="h-5 w-14 animate-pulse rounded-md bg-[#f5f0f5]" />
          <div className="h-5 w-12 animate-pulse rounded-md bg-[#f5f0f5]" />
          <div className="h-5 w-16 animate-pulse rounded-md bg-[#f5f0f5]" />
        </div>
        <div className="flex gap-2 pt-4">
          <div className="h-[38px] flex-1 animate-pulse rounded-xl bg-[#f5f0f5]" />
          <div className="h-[38px] flex-1 animate-pulse rounded-xl bg-[#f0eaf0]" />
        </div>
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
        <h2 className="text-xl font-semibold text-[#1a1a1a]">No clinics found</h2>
        <p className="mt-2 max-w-md text-sm text-brand-muted">
          {q && location
            ? `We couldn't find any clinics matching "${q}" in "${location}". Try broadening your search.`
            : q
              ? `We couldn't find any clinics matching "${q}". Try a different treatment or service name.`
              : location
                ? `We couldn't find any clinics in "${location}". Try a different city or zip code.`
                : "Try searching for a treatment or location to find clinics near you."
          }
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onClear} className="rounded-xl">
          Clear Search
        </Button>
        <Button variant="gradient" onClick={() => window.location.href = "/"} className="rounded-xl">
          Back to Home
        </Button>
      </div>
    </div>
  );
}
