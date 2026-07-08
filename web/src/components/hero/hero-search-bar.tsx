"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MapPin, Search, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  SearchableDropdown,
  type DropdownOption,
} from "@/components/ui/searchable-dropdown";
import {
  LocationTypeahead,
  type LocationSelection,
} from "@/components/ui/location-typeahead";
import { useLocation } from "@/lib/location/location-context";
import { cn } from "@/lib/utils";

export function HeroSearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const { location: userLocation, status, requestLocation } = useLocation();
  const [service, setService] = useState("");
  const [location, setLocation] = useState("");
  // Coordinates of the picked suggestion (null for free text — the search API
  // resolves bare zips / "City, ST" server-side as a fallback).
  const [locationGeo, setLocationGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [serviceOptions, setServiceOptions] = useState<DropdownOption[]>([]);

  // Prefill once the visitor asks for their location and we resolve a US
  // city/state (unless they've already typed something). Never overrides a
  // manual choice; never fills a non-US place (search is USA-only — the
  // USA-only notice explains it instead).
  useEffect(() => {
    if (userLocation?.outsideUS) return;
    if (userLocation?.city || userLocation?.stateCode) {
      setLocation((prev) =>
        prev ||
        (userLocation.city && userLocation.stateCode
          ? `${userLocation.city}, ${userLocation.stateCode}`
          : userLocation.stateCode || ""),
      );
    }
  }, [userLocation?.city, userLocation?.stateCode, userLocation?.outsideUS]);

  // Fetch services from DB
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (service.trim()) params.set("q", service.trim());
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

  return (
    <form
      onSubmit={handleSearch}
      className={cn(
        "relative flex w-full flex-col rounded-[18px] bg-white shadow-lg sm:flex-row sm:items-stretch sm:h-[75px]",
        className,
      )}
    >
      {/* ── Services dropdown ── */}
      <div className="flex flex-1 flex-col justify-center gap-2 px-5 py-4 sm:py-0 sm:pl-6">
        <SearchableDropdown
          options={serviceOptions}
          value={service}
          onChange={setService}
          placeholder="Search treatments…"
          icon={
            <span className="flex size-5 items-center justify-center rounded-full bg-brand-magenta text-white">
              <Sparkles className="size-3" aria-hidden />
            </span>
          }
          label="Treatment"
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
  );
}
