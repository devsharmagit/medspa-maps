"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  Crown,
  Eye,
  Images,
  LocateFixed,
  MapPin,
  Phone,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { LocationTypeahead } from "@/components/ui/location-typeahead";
import {
  SearchableDropdown,
  type DropdownOption,
} from "@/components/ui/searchable-dropdown";
import { useLocation } from "@/lib/location/location-context";
import { toStateCode } from "@/lib/location/states";
import { NOTICE_REFRESH_EVENT } from "@/components/location/usa-only-notice";
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

interface ClinicLocation {
  id: string;
  label: string | null;
  city: string | null;
  state: string | null;
  is_primary: boolean;
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
  ext_rating: number | null;
  ext_review_count: number | null;
  featured: boolean;
  tier: string;
  verified: boolean;
  booking_url: string | null;
  logo_url: string | null;
  services: ClinicService[];
  cover_image_url: string | null;
  gallery_images: string[];
  location_count: number;
  locations: ClinicLocation[];
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
  // Mobile-only: filters live in a bottom-sheet modal to keep results above the fold.
  const [showFilters, setShowFilters] = useState(false);
  // Track if we need to show a "share location" hint on the distance filter
  const [showShareHint, setShowShareHint] = useState(false);

  // Search-bar state
  const [searchService, setSearchService] = useState(q);
  const [searchState, setSearchState] = useState(location);
  const [serviceOptions, setServiceOptions] = useState<DropdownOption[]>([]);

  // Detected visitor location (shared context). We do NOT auto-prompt — the user
  // opts in via "Use my current location" in the location field (handleNearMe).
  const {
    status,
    location: userLoc,
    outsideUS,
    requested,
    requestLocation,
    clearLocation: clearCtxLocation,
  } = useLocation();

  // "San Francisco, CA" when we have both (matches the typeahead city-pick and
  // the home page), else the bare state code, else "".
  const cityStateLabel = (loc: typeof userLoc): string =>
    loc?.city && loc?.stateCode
      ? `${loc.city}, ${loc.stateCode}`
      : loc?.stateCode ?? "";
  const injectedRef = useRef(false);
  // Guards against out-of-order responses: when location injects lat/lng we fire
  // a second fetch immediately, and the slower (stale) one must not clobber it.
  const fetchIdRef = useRef(0);
  // Set true while an explicit "Near Me" detection is in flight, so we can turn
  // its result into the right URL state (pin the visitor's own state + coords).
  const nearMeRef = useRef(false);

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
    const myId = ++fetchIdRef.current;
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
      if (myId !== fetchIdRef.current) return; // a newer fetch superseded this one
      setResults(data.results);
      setTotal(data.total);
    } catch {
      if (myId !== fetchIdRef.current) return;
      setError("Something went wrong. Please try again.");
    } finally {
      if (myId === fetchIdRef.current) setLoading(false);
    }
  }, [q, location, sort, radius, rating, lat, lng]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  // Reflect the URL into the search fields, and prefill the state from the
  // visitor's detected location when the URL has none yet. Only runs on URL /
  // detected-state changes, so it never fights a manual edit.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setSearchService(q);
    // Show the URL's location; otherwise the detected City, ST — but ONLY after an
    // explicit request (never from a position rehydrated at load).
    setSearchState(location || (requested ? cityStateLabel(userLoc) : ""));
    /* eslint-enable react-hooks/set-state-in-effect */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, location, requested, userLoc?.city, userLoc?.stateCode]);

  // Replace (not push) filter changes so browser back goes to the previous PAGE,
  // not the previous filter state.
  const pushParams = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      router.replace(`/search?${params.toString()}`);
    },
    [router, searchParams]
  );

  const updateParam = (key: string, value: string) => {
    pushParams({ [key]: value || null });
  };

  // On first arrival, enable "near me" by writing the visitor's coordinates to the
  // URL once — but ONLY when the view is consistent with where they are. If they're
  // explicitly viewing a DIFFERENT state (e.g. they're in California but picked Utah
  // on the home page), distance-from-me is meaningless, so we leave the origin — and
  // therefore the distance filter — OFF. We never set a radius here.
  useEffect(() => {
    if (!requested) return; // only act on an explicit request, not stored state
    if (injectedRef.current) return;
    if (userLoc?.lat == null || userLoc?.lng == null) return; // wait for detection
    injectedRef.current = true; // one-shot decision for this landing
    // Distance/origin is a USA-only feature — never write coords for visitors we
    // know are outside the US (keeps lat/lng out of the search query entirely).
    if (userLoc.outsideUS) return;
    if (hasOrigin) return; // URL already carries an origin
    const filterState = toStateCode(location);
    if (filterState && filterState !== userLoc.stateCode) return; // different state
    pushParams({
      // Pin the detected City, ST so results are scoped there (not all clinics),
      // while lat/lng still power distance sort/filter. Keeps any location the URL
      // already carries.
      location: location || cityStateLabel(userLoc) || null,
      lat: userLoc.lat.toFixed(6),
      lng: userLoc.lng.toFixed(6),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested, hasOrigin, userLoc?.lat, userLoc?.lng, userLoc?.city, userLoc?.stateCode, userLoc?.outsideUS, location, pushParams]);

  // Distance is USA-only: if we know the visitor is outside the US, make sure no
  // origin/radius lingers in the URL — whether from a shared link, stale storage,
  // or a prior in-US session — so we never query or sort by distance for them.
  useEffect(() => {
    if (!outsideUS) return;
    if (hasOrigin || radius) {
      pushParams({ lat: null, lng: null, radius: null });
    }
  }, [outsideUS, hasOrigin, radius, pushParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    pushParams({
      q: searchService.trim() || null,
      location: searchState.trim() || null,
    });
  };

  const handleNearMe = () => {
    setGeoError("");
    setShowShareHint(false);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("Geolocation is not available.");
      return;
    }
    // Re-detect the visitor's ACTUAL location. We turn the result into URL state
    // ourselves (below), so suppress the passive one-shot auto-inject.
    nearMeRef.current = true;
    injectedRef.current = true;
    // If the USA-only notice was dismissed, resurface it so an outside-US visitor
    // gets clear feedback that "Near Me" can't be used here (not a broken button).
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(NOTICE_REFRESH_EVENT));
    }
    requestLocation({ force: true });
  };

  // Resolve an explicit "Near Me" request once detection settles.
  useEffect(() => {
    if (!nearMeRef.current) return;
    if (status === "prompting") return; // still detecting
    if (status !== "granted" || !userLoc) {
      nearMeRef.current = false; // denied/unavailable → blocked-message UI handles it
      return;
    }
    nearMeRef.current = false;
    if (userLoc.outsideUS || userLoc.lat == null || userLoc.lng == null) {
      // Outside the US: no proximity search. The outside-US effect strips any
      // origin/radius and the (resurfaced) USA-only notice explains why.
      return;
    }
    // In the US: center on the visitor — pin THEIR City, ST AND coordinates, so
    // the location is preserved (not wiped to "all locations") and distance
    // features turn on. City-level matches the home page + typeahead behavior.
    const label = cityStateLabel(userLoc);
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setSearchState(label);
    pushParams({
      location: label || null,
      lat: userLoc.lat.toFixed(6),
      lng: userLoc.lng.toFixed(6),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userLoc?.outsideUS, userLoc?.lat, userLoc?.lng, userLoc?.city, userLoc?.stateCode, pushParams]);

  // Fill the location box with the detected City, ST — only after an explicit
  // request, never from a stored position. Success feedback IS the filled box
  // (no toast); the USA-only notice only covers outside-US / failed cases.
  useEffect(() => {
    if (!requested) return;
    if (status === "granted" && userLoc && !userLoc.outsideUS && !searchState) {
      /* eslint-disable-next-line react-hooks/set-state-in-effect */
      setSearchState(cityStateLabel(userLoc));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requested, status, userLoc?.city, userLoc?.stateCode, userLoc?.outsideUS]);

  // Handler for when user clicks a distance radio without sharing location
  const handleDistanceClick = (bandRadius: number) => {
    if (outsideUS) return; // distance filtering is USA-only
    if (!hasOrigin) {
      setShowShareHint(true);
      return;
    }
    updateParam("radius", String(bandRadius));
  };

  // Apply a state selection immediately — no separate "Search" click needed.
  // Picking your OWN detected state keeps "near me" distance features; picking a
  // DIFFERENT state is an explicit filter, so the distance origin (which is
  // relative to you) is dropped.
  const applyState = (value: string) => {
    setSearchState(value);
    injectedRef.current = true; // manual choice — suspend the auto-inject effect
    const matchesDetected =
      Boolean(value) &&
      userLoc?.stateCode === value &&
      userLoc?.lat != null &&
      userLoc?.lng != null;
    if (matchesDetected) {
      pushParams({
        location: value,
        lat: userLoc!.lat.toFixed(6),
        lng: userLoc!.lng.toFixed(6),
        radius: null,
      });
    } else {
      pushParams({
        location: value || null,
        lat: null,
        lng: null,
        radius: null,
        sort: null,
      });
    }
  };

  // Apply a typeahead pick (zip or city suggestion) immediately. A picked
  // suggestion carries its own coordinates → distance search from that point,
  // regardless of where the visitor physically is. Free text just updates the
  // input; the form submit sends it as-is (the API resolves zips server-side).
  const applyLocationSelection = (sel: {
    label: string;
    value: string;
    lat: number | null;
    lng: number | null;
  }) => {
    setSearchState(sel.value);
    if (sel.lat !== null && sel.lng !== null) {
      injectedRef.current = true; // manual choice — suspend the auto-inject effect
      pushParams({
        location: sel.value,
        lat: sel.lat.toFixed(6),
        lng: sel.lng.toFixed(6),
        radius: null,
        sort: null,
      });
    }
  };

  // Fully de-select the location: clears the GPS origin, the state filter, the
  // distance band, and the remembered position — back to a clean slate.
  const clearUserLocation = () => {
    injectedRef.current = true; // don't auto re-inject after an explicit clear
    clearCtxLocation();
    setSearchState("");
    pushParams({
      lat: null,
      lng: null,
      location: null,
      radius: null,
      sort: null,
    });
  };

  const clearFilters = () => {
    // Full reset: drop every filter AND the detected location so nothing lingers —
    // no state filter, no field value, no "using your location" chip, no distance
    // filter. Lands on a clean slate showing all clinics by rating.
    injectedRef.current = true;
    clearCtxLocation();
    setSearchService("");
    setSearchState("");
    router.push("/search");
  };

  // Resolve display label for the title
  const stateName =
    STATES.find((s) => s.abbr.toLowerCase() === location.toLowerCase())?.name ||
    location;
  const serviceName =
    serviceOptions.find((s) => s.value === q)?.label || q || "Treatments";

  // Which distance band (if any) is selected. Snap any radius to a band (exact,
  // else the smallest band that covers it) so a URL value like radius=10 — which
  // isn't itself a band value — still shows the right radio as checked.
  const radiusNum = radius ? Number(radius) : null;
  const activeBandRadius =
    radiusNum == null || Number.isNaN(radiusNum)
      ? null
      : (
          DISTANCE_BANDS.find((b) => b.radius === radiusNum) ??
          DISTANCE_BANDS.find((b) => radiusNum <= b.radius) ??
          DISTANCE_BANDS[DISTANCE_BANDS.length - 1]
        ).radius;

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
              onSelect={(opt) => updateParam("q", opt.value)}
              placeholder="Treatment or clinic…"
              className="flex-1"
              allowFreeText
            />
          </div>

          {/* Location typeahead — ZIP or city + "use my location" on focus */}
          <div className="flex flex-1 items-center gap-3 rounded-xl border border-[#e8e0e8] px-4 py-2.5">
            <MapPin className="size-5 shrink-0 text-brand-magenta" aria-hidden />
            <LocationTypeahead
              value={searchState}
              onChange={applyLocationSelection}
              placeholder="ZIP code or city…"
              className="flex-1"
              onUseMyLocation={handleNearMe}
              locating={status === "prompting"}
            />
          </div>

          <Button
            type="submit"
            variant="gradient"
            className="h-auto gap-2 rounded-xl px-6 py-3 text-sm font-semibold"
          >
            <Search className="size-4" aria-hidden />
            Search
          </Button>
        </form>

        {/* Active location / state filter + a clear-it control */}
        {(hasOrigin || location) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-magenta/8 px-2.5 py-1 font-medium text-brand-magenta">
              <LocateFixed className="size-3.5" />
              {hasOrigin
                ? `Using your location${userLoc?.stateName ? ` · ${userLoc.stateName}` : ""}`
                : `Showing ${stateName}`}
            </span>
            <button
              type="button"
              onClick={clearUserLocation}
              className="inline-flex items-center gap-1 rounded-full border border-[#e8e0e8] px-2.5 py-1 font-medium text-brand-muted transition-colors hover:border-brand-magenta/40 hover:text-brand-magenta"
              aria-label="Clear selected location"
            >
              <X className="size-3.5" />
              Clear location
            </button>
          </div>
        )}
        {!hasOrigin && !location && (geoError || status === "denied") && (
          <p className="mt-3 text-xs text-brand-muted">
            {geoError ||
              "Location access is blocked — enable it in your browser to sort and filter by distance."}
          </p>
        )}
      </div>

      {/* ── Body: sidebar + results ─────────────────────────────────────── */}
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* ── Filter Sidebar (desktop only) ──────────────────────────────── */}
        <aside className="hidden w-full shrink-0 lg:block lg:w-[260px]">
          <div className="flex flex-col gap-6 rounded-2xl border border-[#ece6ec] bg-white p-5 shadow-sm">
            {/* Distance / Radius — always visible */}
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#1a1a1a]">
                  Distance / Radius
                </h3>
                {hasOrigin && activeBandRadius && (
                  <button
                    type="button"
                    onClick={() => updateParam("radius", "")}
                    className="text-xs font-medium text-brand-magenta hover:opacity-70"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="mt-3 flex flex-col gap-2.5">
                {DISTANCE_BANDS.map((band) => {
                  const checked = activeBandRadius === band.radius;
                  return (
                    <label
                      key={band.radius}
                      className={cn(
                        "flex items-center gap-2.5 text-sm",
                        hasOrigin ? "cursor-pointer text-[#4a4a4a]" : "text-[#9a9a9a]",
                        outsideUS && "cursor-not-allowed opacity-60"
                      )}
                      onClick={(e) => {
                        if (!hasOrigin) {
                          e.preventDefault();
                          handleDistanceClick(band.radius);
                        }
                      }}
                    >
                      <input
                        type="radio"
                        name="distance"
                        checked={checked}
                        disabled={outsideUS}
                        onChange={() => handleDistanceClick(band.radius)}
                        className="size-4 accent-brand-magenta"
                      />
                      {band.label}
                    </label>
                  );
                })}
              </div>

              {/* Availability hint */}
              {outsideUS ? (
                <p className="mt-2 text-[11px] text-brand-muted">
                  Distance filtering is available for USA locations only.
                </p>
              ) : showShareHint && !hasOrigin ? (
                <button
                  type="button"
                  onClick={handleNearMe}
                  className="mt-3 flex w-full items-center gap-2 rounded-xl border border-dashed border-[#e0c9e0] bg-[#faf5fa] px-3 py-2.5 text-left text-xs text-brand-muted transition-colors hover:border-brand-magenta/50 hover:text-brand-magenta animate-pulse"
                >
                  <LocateFixed className="size-4 shrink-0 text-brand-magenta" />
                  Please share your location to use distance filters
                </button>
              ) : !hasOrigin ? (
                <p className="mt-2 text-[11px] text-brand-muted">
                  Use my location (in the location box) or select a distance to enable
                </p>
              ) : null}
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
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[#1a1a1a]">
              {loading ? "Searching…" : `${total} Clinics Found`}
            </h2>

            {/* Mobile: open filters + sort in a modal */}
            <button
              type="button"
              onClick={() => setShowFilters(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-[#e1e1e1] bg-white px-4 py-2 text-sm font-medium text-[#4a4a4a] transition-colors hover:border-brand-magenta/40 hover:text-brand-magenta lg:hidden"
            >
              <SlidersHorizontal className="size-4" />
              Filters &amp; Sort
              {(rating || radius) && (
                <span className="flex size-5 items-center justify-center rounded-full bg-brand-magenta text-[11px] font-semibold text-white">
                  {[rating, radius].filter(Boolean).length}
                </span>
              )}
            </button>

            {/* Desktop: inline sort */}
            <div className="hidden items-center gap-2 lg:flex">
              <span className="text-sm text-brand-muted">Sorted By:</span>
              <div className="relative flex items-center">
                <select
                  value={sort}
                  onChange={(e) => updateParam("sort", e.target.value)}
                  className="appearance-none rounded-xl border border-[#e1e1e1] bg-white py-2 pl-3.5 pr-9 text-sm font-medium text-[#4a4a4a] transition-colors hover:border-brand-magenta/40 focus:outline-none focus:ring-2 focus:ring-brand-magenta/20"
                >
                  <option value="distance" disabled={!hasOrigin}>
                    Distance{outsideUS ? " (USA only)" : !hasOrigin ? " (share location)" : ""}
                  </option>
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
              <EmptyState q={q} location={stateName} onClear={clearFilters} />
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

      {/* ── Mobile filters & sort modal ─────────────────────────────────── */}
      {showFilters && (
        <div
          className="fixed inset-0 z-[120] lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Filters and sort"
        >
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowFilters(false)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#ece6ec] px-5 py-4">
              <h3 className="text-base font-semibold text-[#1a1a1a]">Filters &amp; Sort</h3>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                aria-label="Close"
                className="rounded-full p-1.5 text-brand-muted transition-colors hover:bg-[#f5f0f5]"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex flex-col gap-6 overflow-y-auto p-5">
              {/* Sort */}
              <div>
                <h4 className="text-sm font-semibold text-[#1a1a1a]">Sort By</h4>
                <div className="mt-3 flex flex-col gap-2.5">
                  <label className={cn("flex items-center gap-2.5 text-sm", hasOrigin ? "cursor-pointer text-[#4a4a4a]" : "cursor-not-allowed opacity-50")}>
                    <input type="radio" name="sort-modal" disabled={!hasOrigin} checked={sort === "distance"} onChange={() => updateParam("sort", "distance")} className="size-4 accent-brand-magenta" />
                    Distance{outsideUS ? " (USA only)" : !hasOrigin ? " (share location)" : ""}
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[#4a4a4a]">
                    <input type="radio" name="sort-modal" checked={sort === "rating"} onChange={() => updateParam("sort", "rating")} className="size-4 accent-brand-magenta" />
                    Rating
                  </label>
                </div>
              </div>

              <div className="h-px bg-[#ece6ec]" />

              {/* Distance */}
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[#1a1a1a]">Distance / Radius</h4>
                  {hasOrigin && activeBandRadius && (
                    <button type="button" onClick={() => updateParam("radius", "")} className="text-xs font-medium text-brand-magenta">
                      Reset
                    </button>
                  )}
                </div>
                <div className="mt-3 flex flex-col gap-2.5">
                  {DISTANCE_BANDS.map((band) => (
                    <label
                      key={band.radius}
                      className={cn(
                        "flex items-center gap-2.5 text-sm",
                        hasOrigin ? "cursor-pointer text-[#4a4a4a]" : "text-[#9a9a9a]",
                        outsideUS && "cursor-not-allowed opacity-60"
                      )}
                      onClick={(e) => {
                        if (!hasOrigin) {
                          e.preventDefault();
                          handleDistanceClick(band.radius);
                        }
                      }}
                    >
                      <input type="radio" name="distance-modal" checked={activeBandRadius === band.radius} disabled={outsideUS} onChange={() => handleDistanceClick(band.radius)} className="size-4 accent-brand-magenta" />
                      {band.label}
                    </label>
                  ))}
                </div>
                {outsideUS ? (
                  <p className="mt-2 text-[11px] text-brand-muted">
                    Distance filtering is available for USA locations only.
                  </p>
                ) : showShareHint && !hasOrigin ? (
                  <button
                    type="button"
                    onClick={handleNearMe}
                    className="mt-3 flex w-full items-center gap-2 rounded-xl border border-dashed border-[#e0c9e0] bg-[#faf5fa] px-3 py-2.5 text-left text-xs text-brand-muted animate-pulse"
                  >
                    <LocateFixed className="size-4 shrink-0 text-brand-magenta" />
                    Please share your location to use distance filters
                  </button>
                ) : null}
              </div>

              <div className="h-px bg-[#ece6ec]" />

              {/* Rating */}
              <div>
                <h4 className="text-sm font-semibold text-[#1a1a1a]">Rating</h4>
                <div className="mt-3 flex flex-col gap-2.5">
                  {RATING_BANDS.map((band) => (
                    <label key={band.value} className="flex cursor-pointer items-center gap-2.5 text-sm text-[#4a4a4a]">
                      <input type="radio" name="rating-modal" checked={rating === band.value} onChange={() => updateParam("rating", band.value)} className="size-4 accent-brand-magenta" />
                      <span className="inline-flex items-center gap-1">
                        <Star className="size-3.5 fill-[#FFBA19] text-[#FFBA19]" />
                        {band.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center gap-3 border-t border-[#ece6ec] p-4">
              <button
                type="button"
                onClick={() => {
                  clearFilters();
                  setShowFilters(false);
                }}
                className="flex-1 rounded-xl border border-[#e8e0e8] px-4 py-2.5 text-sm font-medium text-brand-magenta transition-colors hover:bg-brand-magenta/5"
              >
                Clear All
              </button>
              <Button
                variant="gradient"
                onClick={() => setShowFilters(false)}
                className="h-auto flex-1 rounded-xl py-2.5 text-sm font-semibold"
              >
                Show {total} Results
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Clinic Card ──────────────────────────────────────────────────────────────

function ClinicCard({ clinic }: { clinic: ClinicResult }) {
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

  const profileUrl = `/clinics/${clinic.clinic_slug}`;
  const bookUrl = clinic.booking_url || clinic.website || profileUrl;

  return (
    <div className="flex flex-col gap-5 overflow-hidden rounded-2xl border border-[#ece6ec] bg-white p-4 shadow-sm transition-shadow hover:shadow-[0_8px_30px_rgba(170,78,179,0.10)] sm:flex-row sm:p-5">
      {/* Left: cover + thumbnails */}
      <div className="w-full shrink-0 sm:w-[220px]">
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
          {clinic.verified && (
            <BadgeCheck className="size-4 shrink-0 fill-brand-magenta text-white" />
          )}
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
        <Button
          variant="outline"
          className="h-[42px] gap-2 rounded-xl text-sm font-semibold"
          asChild
        >
          <a href={profileUrl}>
            <Eye className="size-4" />
            View Clinic
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
          Clear Filters
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
