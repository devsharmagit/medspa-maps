"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HeartPulse, MapPin, Search, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import {
  LocationTypeahead,
  type LocationSelection,
} from "@/components/ui/location-typeahead";
import {
  useTreatmentConditionOptions,
  splitSearchSelection,
} from "@/lib/search/search-options";
import { useLocation } from "@/lib/location/location-context";
import { cn } from "@/lib/utils";

export function HeroSearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const { location: userLocation, status, requested, requestLocation } = useLocation();
  const [searchMode, setSearchMode] = useState<"treatment" | "condition">("treatment");
  const [service, setService] = useState("");
  const [location, setLocation] = useState("");
  // Coordinates of the picked suggestion (null for free text — the search API
  // resolves bare zips / "City, ST" server-side as a fallback).
  const [locationGeo, setLocationGeo] = useState<{ lat: number; lng: number } | null>(null);
  const serviceOptions = useTreatmentConditionOptions();
  const treatmentOptions = serviceOptions.filter((option) => option.group === "Treatments");
  const conditionOptions = serviceOptions.filter((option) => option.group === "Conditions");
  const activeOptions = searchMode === "treatment" ? treatmentOptions : conditionOptions;

  // Prefill ONLY after the visitor clicks "Use my current location" and we
  // resolve a US city/state (unless they've already typed something). Never on a
  // stored position rehydrated at load, never a non-US place (the USA-only
  // notice explains that instead).
  useEffect(() => {
    if (!requested || userLocation?.outsideUS) return;
    if (userLocation?.city || userLocation?.stateCode) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setLocation((prev) =>
        prev ||
        (userLocation.city && userLocation.stateCode
          ? `${userLocation.city}, ${userLocation.stateCode}`
          : userLocation.stateCode || ""),
      );
    }
  }, [requested, userLocation?.city, userLocation?.stateCode, userLocation?.outsideUS]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchMode === "treatment") {
      if (service.trim()) params.set("q", service.trim());
    } else {
      const { condition } = splitSearchSelection(service);
      const conditionValue = condition || service.trim();
      if (conditionValue) params.set("condition", conditionValue);
    }
    if (location.trim()) params.set("location", location.trim());
    // Picked suggestion carries exact coordinates → instant radius search.
    if (locationGeo) {
      params.set("lat", String(locationGeo.lat));
      params.set("lng", String(locationGeo.lng));
    }
    router.push(`/search?${params.toString()}`);
  };

  const handleLocationChange = (sel: LocationSelection) => {
    setLocation(sel.value);
    setLocationGeo(sel.lat !== null && sel.lng !== null ? { lat: sel.lat, lng: sel.lng } : null);
  };

  const chooseMode = (mode: "treatment" | "condition") => {
    setSearchMode(mode);
    setService("");
  };

  return (
    <div className={cn("flex w-full flex-col items-start gap-3", className)}>
      <div className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/18 p-1 shadow-[0_8px_30px_rgba(61,46,56,0.12)] backdrop-blur-md">
        <span className="pl-3 pr-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/85">
          Search for
        </span>
        <button
          type="button"
          onClick={() => chooseMode("treatment")}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold uppercase tracking-[0.08em] transition-colors",
            searchMode === "treatment"
              ? "bg-white text-brand-magenta shadow-sm"
              : "text-white/80 hover:bg-white/10 hover:text-white",
          )}
        >
          <Sparkles className="size-3.5" aria-hidden />
          Treatment
        </button>
        <button
          type="button"
          onClick={() => chooseMode("condition")}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold uppercase tracking-[0.08em] transition-colors",
            searchMode === "condition"
              ? "bg-white text-brand-magenta shadow-sm"
              : "text-white/80 hover:bg-white/10 hover:text-white",
          )}
        >
          <HeartPulse className="size-3.5" aria-hidden />
          Condition
        </button>
      </div>

      <form
        onSubmit={handleSearch}
        className="relative flex w-full flex-col rounded-[18px] bg-white shadow-lg sm:h-[75px] sm:flex-row sm:items-stretch"
      >
        {/* ── Treatment / condition dropdown ── */}
        <div className="flex flex-1 flex-col justify-center gap-2 px-5 py-4 sm:py-0 sm:pl-6">
        <SearchableDropdown
          options={activeOptions}
          value={service}
          onChange={setService}
          placeholder={searchMode === "treatment" ? "Search treatments…" : "Search conditions…"}
          icon={
            <span className="flex size-5 items-center justify-center rounded-full bg-brand-magenta text-white">
              {searchMode === "treatment" ? (
                <Sparkles className="size-3" aria-hidden />
              ) : (
                <HeartPulse className="size-3" aria-hidden />
              )}
            </span>
          }
          label={searchMode === "treatment" ? "Treatment" : "Condition"}
          allowFreeText
        />
      </div>

      {/* ── Location dropdown ── */}
      <div className="flex flex-1 items-stretch border-t border-[#e1e1e1] sm:border-t-0 sm:border-l">
        <div className="flex flex-1 flex-col justify-center gap-2 px-5 py-4 sm:py-0 sm:pl-[18px]">
          <LocationTypeahead
            value={location}
            onChange={handleLocationChange}
            placeholder="ZIP code or city…"
            icon={<MapPin className="size-5 text-brand-magenta" aria-hidden />}
            label="Location"
            onUseMyLocation={() => requestLocation({ force: true })}
            locating={status === "prompting"}
          />
        </div>

        <div className="flex items-center px-3 pb-4 sm:px-3.5 sm:pb-0">
          <Button
            type="submit"
            variant={"gradient"}
            className="h-[47px] gap-2.5 rounded-lg border-0 px-6 text-sm font-semibold text-white"
          >
            <Search className="size-5" aria-hidden />
            Search
          </Button>
        </div>
      </div>
      </form>
    </div>
  );
}
