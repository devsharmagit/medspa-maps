"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MapPin, Search, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  SearchableDropdown,
  type DropdownOption,
} from "@/components/ui/searchable-dropdown";
import { US_STATES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function HeroSearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const [service, setService] = useState("");
  const [location, setLocation] = useState("");
  const [serviceOptions, setServiceOptions] = useState<DropdownOption[]>([]);

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
    router.push(`/search?${params.toString()}`);
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
          placeholder="Search treatment, condition or services..."
          icon={
            <span className="flex size-5 items-center justify-center rounded-full bg-brand-magenta text-white">
              <Sparkles className="size-3" aria-hidden />
            </span>
          }
          label="Services"
          allowFreeText
        />
      </div>

      {/* ── Location dropdown ── */}
      <div className="flex flex-1 items-stretch border-t border-[#e1e1e1] sm:border-t-0 sm:border-l">
        <div className="flex flex-1 flex-col justify-center gap-2 px-5 py-4 sm:py-0 sm:pl-[18px]">
          <SearchableDropdown
            options={US_STATES}
            value={location}
            onChange={setLocation}
            placeholder='Select a state…'
            icon={<MapPin className="size-5 text-brand-magenta" aria-hidden />}
            label="Location"
          />
        </div>

        <div className="flex items-center px-3 pb-4 sm:px-3.5 sm:pb-0">
          <Button
            type="submit"
            variant={"gradient"}
            className="h-[47px] gap-2.5 rounded-lg border-0 px-6 text-sm font-semibold text-white shadow-none hover:opacity-90"
          >
            <Search className="size-5" aria-hidden />
            Search
          </Button>
        </div>
      </div>
    </form>
  );
}
