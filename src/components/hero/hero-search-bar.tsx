"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MapPin, Search, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function HeroSearchBar({ className }: { className?: string }) {
  const router = useRouter();
  const [service, setService] = useState("");
  const [location, setLocation] = useState("");

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
        "flex w-full flex-col overflow-hidden rounded-[18px] bg-white shadow-lg sm:flex-row sm:items-stretch sm:h-[75px]",
        className,
      )}
    >
      <div className="flex flex-1 flex-col justify-center gap-2 px-5 py-4 sm:py-0 sm:pl-6">
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded-full bg-brand-magenta text-white">
            <Sparkles className="size-3" aria-hidden />
          </span>
          <span className="text-sm font-semibold uppercase tracking-wide text-brand-muted">
            Services
          </span>
        </div>
        <input
          type="search"
          value={service}
          onChange={(e) => setService(e.target.value)}
          placeholder="Search treatment, condition or services..."
          className="w-full border-0 bg-transparent p-0 text-sm text-foreground placeholder:text-brand-placeholder focus:outline-none focus:ring-0"
          aria-label="Search services"
        />
      </div>

      <div className="flex flex-1 items-stretch border-t border-[#e1e1e1] sm:border-t-0 sm:border-l">
        <div className="flex flex-1 flex-col justify-center gap-2 px-5 py-4 sm:py-0 sm:pl-[18px]">
          <div className="flex items-center gap-2">
            <MapPin className="size-5 text-brand-magenta" aria-hidden />
            <span className="text-sm font-semibold uppercase tracking-wide text-brand-muted">
              Location
            </span>
          </div>
          <input
            type="search"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder='City, Zip or "Near Me"'
            className="w-full border-0 bg-transparent p-0 text-sm text-foreground placeholder:text-brand-placeholder focus:outline-none focus:ring-0"
            aria-label="Search location"
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
