"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { reverseGeocode } from "./reverse-geocode";

export type LocationStatus =
  | "idle" // nothing requested yet
  | "prompting" // waiting on the browser permission dialog
  | "granted" // we have a position
  | "denied" // user declined
  | "unavailable"; // no geolocation API / hardware error

export interface UserLocation {
  lat: number;
  lng: number;
  stateCode: string | null;
  stateName: string | null;
  city: string | null;
  countryCode: string | null;
  /** True when we positively know the visitor is not in the USA. */
  outsideUS: boolean;
}

interface LocationContextValue {
  status: LocationStatus;
  location: UserLocation | null;
  /** True when the browser location resolves to a country other than the US. */
  outsideUS: boolean;
  /** Ask the browser for the user's position. No-op if already resolved unless `force`. */
  requestLocation: (opts?: { force?: boolean }) => void;
  /** Forget the stored location (and stop auto-filling). */
  clearLocation: () => void;
}

const STORAGE_KEY = "medspa.userLocation.v1";
const MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [location, setLocationState] = useState<UserLocation | null>(null);
  const requestedRef = useRef(false);

  // Hydrate a recent, previously-granted location so we don't re-prompt.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (
        parsed?.ts &&
        Date.now() - parsed.ts < MAX_AGE_MS &&
        parsed.location &&
        typeof parsed.location.lat === "number"
      ) {
        // Hydrating from localStorage must happen after mount (not in a lazy
        // initializer) so server and client first-render agree — otherwise the
        // banner/prefill would flash and cause a hydration mismatch.
        /* eslint-disable react-hooks/set-state-in-effect */
        setLocationState(parsed.location as UserLocation);
        setStatus("granted");
        /* eslint-enable react-hooks/set-state-in-effect */
        requestedRef.current = true;
      }
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  const persist = useCallback((loc: UserLocation | null) => {
    try {
      if (loc) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ts: Date.now(), location: loc }),
        );
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* storage may be unavailable (private mode) */
    }
  }, []);

  const resolvePosition = useCallback(
    async (pos: GeolocationPosition) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      let geo = {
        countryCode: null as string | null,
        stateCode: null as string | null,
        stateName: null as string | null,
        city: null as string | null,
      };
      try {
        geo = await reverseGeocode(lat, lng);
      } catch {
        // Keep coords for distance even if we can't name the place.
      }

      // Only claim "outside US" when we positively know the country isn't US.
      const outsideUS = !!geo.countryCode && geo.countryCode !== "US";

      const loc: UserLocation = { lat, lng, ...geo, outsideUS };
      setLocationState(loc);
      setStatus("granted");
      persist(loc);
    },
    [persist],
  );

  const requestLocation = useCallback(
    (opts?: { force?: boolean }) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setStatus("unavailable");
        return;
      }
      if (!opts?.force && (requestedRef.current || location)) return;
      requestedRef.current = true;
      setStatus("prompting");
      navigator.geolocation.getCurrentPosition(
        (pos) => void resolvePosition(pos),
        (err) => {
          setStatus(
            err.code === err.PERMISSION_DENIED ? "denied" : "unavailable",
          );
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 1000 * 60 * 10 },
      );
    },
    [location, resolvePosition],
  );

  const clearLocation = useCallback(() => {
    setLocationState(null);
    setStatus("idle");
    // Keep requestedRef = true: an explicit clear must NOT auto-prompt again on
    // this visit (the changed callback identity would otherwise re-fire the mount
    // effect). The user can re-detect deliberately via "Near Me" (force: true).
    persist(null);
  }, [persist]);

  return (
    <LocationContext.Provider
      value={{
        status,
        location,
        outsideUS: !!location?.outsideUS,
        requestLocation,
        clearLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation(): LocationContextValue {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return ctx;
}
